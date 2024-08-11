import {match} from 'ts-pattern';
import {inferLiteral} from '../literal.js';
import {
  AliasSql,
  BinarySql,
  CaseSqlWhen,
  EMPTY_SELECT,
  QuerySql,
  SelectSql,
  SelectSqlColumn,
  SelectSqlJoin,
  Sql,
  SqlOrderBy,
  SqlSource,
  falseLiteral,
  oneLiteral,
  trueLiteral,
} from '../sql/sql.js';
import {arrayEqual, assert, assertNever, uniqueBy} from '../utils.js';
import {
  BinaryExpr,
  CaseExpr,
  Expr,
  FuncExpr,
  LiteralExpr,
  LocatorExpr,
  QueryTerminatorExpr,
  SqlExpr,
  UnaryExpr,
  binaryOpIsLogical,
} from './expr.js';
import {ObjectProjection, PropPath, ScalarProjection} from './projection.js';
import {
  CombineQuery,
  FilterQuery,
  FlatMapQuery,
  GroupByQuery,
  JoinQuery,
  MapQuery,
  OrderByQuery,
  PaginationQuery,
  ProxyQuery,
  Query,
  QuerySource,
  UniqueQuery,
  createHandle,
} from './query.js';

export interface CompilationOptions {
  readonly parameters?: boolean;
}

class CompilationContext {
  private aliases = new Map<QuerySource, string>();
  private aliasCounter = 1;
  public readonly parameters: boolean;

  constructor(options: CompilationOptions) {
    this.parameters = options.parameters ?? true;
  }

  getAlias(source: QuerySource): string {
    const existingAlias = this.aliases.get(source);
    if (existingAlias) {
      return existingAlias;
    }

    const newAlias = `s${this.aliasCounter++}`;
    this.aliases.set(source, newAlias);

    return newAlias;
  }

  newAlias(): string {
    return `x${this.aliasCounter++}`;
  }
}

type QueryCompilationResult = CompilationResult<QuerySql>;

export class CompilationError extends Error {
  constructor(
    message: string,
    public sql: Sql,
    public joins: Join[]
  ) {
    super(message);
  }
}

export function compileQuery(
  query: Query<any> | QueryTerminatorExpr<any>,
  options?: CompilationOptions
): QuerySql {
  const ctx = new CompilationContext(options ?? {});
  const {sql, joins} =
    query instanceof Query
      ? _compileQuery(query, ctx)
      : _compileQueryTerminatorExpr(query, ctx);

  if (joins.length > 0) {
    throw new CompilationError(
      'loose joins are not allowed after query compilation',
      sql,
      [...joins]
    );
  }

  return sql;
}

function _compileQuery(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql, joins} = query.visit({
    filter: x => compileFilterQuery(x, ctx),
    map: x => compileMapQuery(x, ctx),
    orderBy: x => compileOrderByQuery(x, ctx),
    join: x => compileJoinQuery(x, ctx),
    combine: x => compileCombineQuery(x, ctx),
    unique: x => compileUniqueQuery(x, ctx),
    pagination: x => compilePaginationQuery(x, ctx),
    proxy: x => compileProxyQuery(x, ctx),
    flatMap: x => compileFlatMapQuery(x, ctx),
    groupBy: x => compileGroupByQuery(x, ctx),
  });

  let newResultJoins: Join[];
  let newResultSql: Sql;
  if (sql.type === 'select') {
    newResultJoins = joins.filter(join => join.rootAlias !== sql.from?.as);
    newResultSql = {
      ...sql,
      joins: [
        ...sql.joins,
        ...uniqueBy(joins, x => x.rightAlias)
          .filter(join => join.rootAlias === sql.from?.as)
          .map(
            (join): SelectSqlJoin => ({
              type: join.type,
              condition: join.condition,
              right: {
                type: 'query',
                query: join.right,
                as: join.rightAlias,
              },
              lateral: false,
            })
          ),
      ],
    };
  } else if (sql.type === 'combination') {
    // we can't attach loose joins to a combination query
    newResultJoins = [...joins];
    newResultSql = sql;
  } else {
    return assertNever(sql, 'invalid sql');
  }

  return {
    sql: newResultSql,
    joins: newResultJoins,
  };
}

function compileQuerySource(
  source: QuerySource,
  ctx: CompilationContext
): CompilationResult<SqlSource> {
  if (source.inner.type === 'query') {
    const query = _compileQuery(source.inner.query, ctx);
    return {
      sql: {
        type: 'query',
        as: ctx.getAlias(source),
        query: query.sql,
      },
      joins: query.joins,
    };
  } else if (source.inner.type === 'table') {
    return {
      sql: {
        type: 'table',
        as: ctx.getAlias(source),
        table: source.inner.name,
      },
      joins: [],
    };
  } else if (source.inner.type === 'sql') {
    const args = source.inner.sql.args.map((arg): ExprCompilationResult => {
      if (arg instanceof Expr) {
        return _compileExpr(arg, ctx);
      }

      return {
        sql: {
          type: 'literal',
          literal: inferLiteral(arg),
          parameter: ctx.parameters,
        },
        joins: [],
      };
    });

    return {
      sql: {
        type: 'sql',
        sql: {
          type: 'raw',
          src: source.inner.sql.src,
          args: args.map(x => x.sql),
        },
        as: ctx.getAlias(source),
      },
      joins: args.flatMap(x => x.joins),
    };
  }

  assertNever(source.inner, 'invalid QuerySource.type');
}

export const SCALAR_COLUMN_ALIAS = 'value';

function compileProjection(
  query: Query<any>,
  ctx: CompilationContext,
  preserveOrder = true
): CompilationResult<SelectSql> {
  const proj = query.projection;
  return match(proj)
    .with({type: 'scalar'}, x =>
      compileScalarProjection(x, query, ctx, preserveOrder)
    )
    .with({type: 'object'}, x =>
      compileObjectProjection(x, query, ctx, preserveOrder)
    )
    .exhaustive();
}

export function isSystemColumn(name: string) {
  return name.startsWith(SYSTEM_COLUMN_PREFIX);
}

export const SYSTEM_COLUMN_PREFIX = '__orm_system_';
export const SYSTEM_ORDERING_COLUMN_PREFIX = `${SYSTEM_COLUMN_PREFIX}_ordering_`;

function orderingColumnAlias(index: number) {
  return `${SYSTEM_ORDERING_COLUMN_PREFIX}_${index}`;
}

interface OrderPropagation {
  readonly columns: readonly SelectSqlColumn[];
  readonly orderBy: readonly SqlOrderBy[] | undefined;
}

// todo: we need to deduplicate system columns, because, for example,
// todo: postgres can't handle ambiguous column references
// order propagation columns must be added at the beginning for
// optimizer to work correctly because of the wildcard selection
function propagateOrdering(source: SqlSource): OrderPropagation {
  if (source.type === 'table' || source.type === 'sql') {
    return {
      columns: [],
      orderBy: undefined,
    };
  }
  return match(source.query)
    .with(
      {type: 'select'},
      (x): OrderPropagation => ({
        columns:
          x.orderBy?.map(
            (_, index): SelectSqlColumn => ({
              as: orderingColumnAlias(index),
              expr: {
                type: 'lookup',
                subject: {type: 'alias', name: source.as},
                prop: orderingColumnAlias(index),
              },
            })
          ) ?? [],
        orderBy: x.orderBy?.map(
          (orderBy, index): SqlOrderBy => ({
            type: orderBy.type,
            expr: {
              type: 'lookup',
              subject: {type: 'alias', name: source.as},
              prop: orderingColumnAlias(index),
            },
          })
        ),
      })
    )
    .with(
      {type: 'combination'},
      (): OrderPropagation => ({columns: [], orderBy: undefined})
    )
    .exhaustive();
}

function compileScalarProjection(
  proj: ScalarProjection,
  query: Query<any>,
  ctx: CompilationContext,
  preserveOrder: boolean
): CompilationResult<SelectSql> {
  const {sql: from, joins: fromJoins} = compileQuerySource(query.source, ctx);
  const {sql: exprSql, joins: exprJoins} = _compileExpr(proj.expr, ctx);
  const joins = [...fromJoins, ...exprJoins];

  const orderPropagation: OrderPropagation = preserveOrder
    ? propagateOrdering(from)
    : {columns: [], orderBy: undefined};

  return {
    sql: {
      type: 'select',
      columns: [
        ...orderPropagation.columns,
        {
          expr: exprSql,
          as: SCALAR_COLUMN_ALIAS,
        },
      ],
      from,
      joins: [],
      distinct: undefined,
      groupBy: undefined,
      having: undefined,
      limit: undefined,
      offset: undefined,
      orderBy: orderPropagation.orderBy,
      where: undefined,
    },
    joins,
  };
}

const PROP_PART_SEPARATOR = '__orm_prop_sep__';
function serializePropPath(path: PropPath): string {
  return path.join(PROP_PART_SEPARATOR);
}

export function deserializePropPath(path: string): PropPath {
  return path.split(PROP_PART_SEPARATOR);
}

function compileObjectProjection(
  proj: ObjectProjection,
  query: Query<any>,
  ctx: CompilationContext,
  preserveOrder: boolean
): CompilationResult<SelectSql> {
  const {sql: from, joins: sourceJoins} = compileQuerySource(query.source, ctx);

  const columns: SelectSqlColumn[] = [];
  const joins: Join[] = [...sourceJoins];

  for (const prop of proj.props) {
    const expr = _compileExpr(prop.expr, ctx);
    columns.push({
      as: serializePropPath(prop.path),
      expr: expr.sql,
    });
    joins.push(...expr.joins);
  }

  const orderPropagation: OrderPropagation = preserveOrder
    ? propagateOrdering(from)
    : {columns: [], orderBy: undefined};

  return {
    sql: {
      type: 'select',
      columns: orderPropagation.columns.concat(columns),
      from,
      joins: [],
      distinct: undefined,
      groupBy: undefined,
      having: undefined,
      limit: undefined,
      offset: undefined,
      orderBy: orderPropagation.orderBy,
      where: undefined,
    },
    joins,
  };
}

function compileFilterQuery(
  query: FilterQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: selectSql, joins: selectJoins} = compileProjection(query, ctx);
  const {sql: whereSql, joins: whereJoins} = _compileExpr(
    query.filterExpr,
    ctx
  );
  const joins = [...selectJoins, ...whereJoins];

  return {
    sql: {
      ...selectSql,
      where: whereSql,
    },
    joins,
  };
}

function compileOrderByQuery(
  query: OrderByQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: selectSql, joins: selectJoins} = compileProjection(query, ctx);
  const joins = [...selectJoins];

  const orderBy: SqlOrderBy[] = [];
  for (const {options, expr} of query.terms) {
    const {sql: orderBySql, joins: orderJoins} = _compileExpr(expr, ctx);
    orderBy.push({
      type: options.desc ? 'desc' : 'asc',
      expr: orderBySql,
    });
    joins.push(...orderJoins);
  }

  return {
    sql: {
      ...selectSql,
      columns: orderBy
        .map(
          (exor, idx): SelectSqlColumn => ({
            as: orderingColumnAlias(idx),
            expr: exor.expr,
          })
        )
        .concat(selectSql.columns.filter(column => !isSystemColumn(column.as))),
      orderBy,
    },
    joins,
  };
}

function compileUniqueQuery(
  query: UniqueQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: selectSql, joins} = compileProjection(query, ctx, false);

  return {
    sql: {
      ...selectSql,
      distinct: true,
    },
    joins,
  };
}

function compilePaginationQuery(
  query: PaginationQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: selectSql, joins} = compileProjection(query, ctx);

  return {
    sql: {
      ...selectSql,
      limit: query.limit_,
      offset: query.offset_,
    },
    joins,
  };
}

function compileProxyQuery(
  query: ProxyQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileProjection(query, ctx);
}

function compileMapQuery(
  query: MapQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileProjection(query, ctx);
}

function extractUserColumnNames(sql: QuerySql): string[] {
  return match(sql)
    .with({type: 'combination'}, extractUserColumnNames)
    .with({type: 'select'}, selectSql =>
      selectSql.columns
        .map(x => x.as)
        .filter(x => !x.startsWith(SYSTEM_ORDERING_COLUMN_PREFIX))
    )
    .exhaustive();
}

function assertColumnListTheSame(a: string[], b: string[]) {
  if (a.length !== b.length) {
    throw new Error(
      'invalid combination query: lhs and rhs must have the same column list'
    );
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      throw new Error(
        'invalid combination query: lhs and rhs must have the same column list'
      );
    }
  }
}

function extractColumnNames(query: QuerySql): string[] {
  if (query.type === 'select') {
    return query.columns.map(x => x.as);
  } else {
    const lhs = extractColumnNames(query.lhs);
    const rhs = extractColumnNames(query.rhs);

    assertColumnListTheSame(lhs, rhs);

    return lhs;
  }
}

function compileCombineQuery(
  query: CombineQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const lhsQuery = new ProxyQuery(query.source);
  const rhsQuery = query.options.other;
  const lhs = _compileQuery(lhsQuery, ctx);
  const rhs = _compileQuery(rhsQuery, ctx);
  const joins = [...lhs.joins, ...rhs.joins];
  const lhsColumns = extractColumnNames(lhs.sql);
  const rhsColumns = extractColumnNames(rhs.sql);
  assertColumnListTheSame(lhsColumns, rhsColumns);

  if (query.options.type === 'concat') {
    const primaryOrderCol = SYSTEM_COLUMN_PREFIX + '__concat_primary_order';
    const secondaryOrderCol = SYSTEM_COLUMN_PREFIX + '__concat_secondary_order';

    const addConcatOrder = (sql: QuerySql, primary: number): QuerySql => {
      const source: SqlSource = {
        type: 'query',
        as: ctx.newAlias(),
        query: sql,
      };
      const {orderBy} = propagateOrdering(source);
      const primaryColumn: SelectSqlColumn = {
        as: primaryOrderCol,
        expr: {
          type: 'literal',
          parameter: false,
          literal: {
            type: {type: 'i32', nullable: false},
            value: primary,
          },
        },
      };

      const sourceColumns: SelectSqlColumn[] = extractUserColumnNames(
        source.query
      ).map(columnName => ({
        type: 'single',
        as: columnName,
        expr: {
          type: 'lookup',
          subject: {
            type: 'alias',
            name: source.as,
          },
          prop: columnName,
        },
      }));

      if (sql.type === 'select') {
        return {
          ...EMPTY_SELECT,
          columns: [
            primaryColumn,
            {
              as: secondaryOrderCol,
              expr: {type: 'row_number', orderBy},
            },
            ...sourceColumns,
          ],
          from: source,
        };
      } else {
        return {
          ...EMPTY_SELECT,
          columns: [
            primaryColumn,
            {
              as: secondaryOrderCol,
              expr: oneLiteral,
            },
            ...sourceColumns,
          ],
          from: source,
        };
      }
    };

    const sourceAlias = ctx.newAlias();
    const orderBy: readonly SqlOrderBy[] = [
      {
        type: 'asc',
        expr: {
          type: 'lookup',
          subject: {type: 'alias', name: sourceAlias},
          prop: primaryOrderCol,
        },
      },
      {
        type: 'asc',
        expr: {
          type: 'lookup',
          subject: {type: 'alias', name: sourceAlias},
          prop: secondaryOrderCol,
        },
      },
    ];
    return {
      sql: {
        ...EMPTY_SELECT,
        columns: [
          ...orderBy.map(
            (x, index): SelectSqlColumn => ({
              as: orderingColumnAlias(index),
              expr: x.expr,
            })
          ),
          ...lhsColumns
            .filter(column => !isSystemColumn(column))
            .map(
              (x): SelectSqlColumn => ({
                as: x,
                expr: {
                  type: 'lookup',
                  prop: x,
                  subject: {type: 'alias', name: sourceAlias},
                },
              })
            ),
        ],
        from: {
          type: 'query',
          as: sourceAlias,
          query: {
            type: 'combination',
            combType: 'union_all',
            lhs: addConcatOrder(lhs.sql, 1),
            rhs: addConcatOrder(rhs.sql, 2),
          },
        },
        orderBy,
      },
      joins,
    };
  } else {
    return {
      sql: {
        type: 'combination',
        lhs: prepareForCombination(lhs.sql),
        rhs: prepareForCombination(rhs.sql),
        combType: query.options.type,
      },
      joins,
    };
  }
}

// todo: sort columns by alias name
function prepareForCombination(
  sql: QuerySql,
  preserveOrderBy = false
): QuerySql {
  if (sql.type !== 'select') return sql;

  return {
    ...sql,
    columns: sql.columns.filter(x => !isSystemColumn(x.as)),
    orderBy: preserveOrderBy ? sql.orderBy : undefined,
  };
}

function compileJoinQuery(
  query: JoinQuery<any>,
  ctx: CompilationContext
): CompilationResult<SelectSql> {
  const filterExpr = query.options.filterExpr ?? Expr.from(true);

  const right = compileQuerySource(query.options.right, ctx);
  const filter = _compileExpr(filterExpr, ctx);
  const projection = compileProjection(query, ctx);
  const joins = [...right.joins, ...filter.joins, ...projection.joins];

  return {
    sql: {
      ...projection.sql,
      joins: [
        {
          type: query.options.type,
          condition: filter.sql,
          right: right.sql,
          lateral: query.options.lateral ?? false,
        },
      ],
    },
    joins,
  };
}

function compileGroupByQuery(
  query: GroupByQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const projection = compileProjection(query, ctx);
  const having = query.having ? _compileExpr(query.having, ctx) : undefined;
  const joins = [...projection.joins, ...(having?.joins ?? [])];
  const groupBy: Sql[] = [];
  for (const expr of query.by) {
    const sql = _compileExpr(expr, ctx);
    groupBy.push(sql.sql);
    joins.push(...sql.joins);
  }

  return {
    sql: {
      ...projection.sql,
      groupBy,
      having: having?.sql,
    },
    joins,
  };
}

function compileFlatMapQuery(
  query: FlatMapQuery<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const right = compileQuerySource(query.options.right, ctx);
  const rightOrderPropagation = propagateOrdering(right.sql);
  const joinQuery = compileJoinQuery(query, ctx);

  return {
    sql: {
      ...joinQuery.sql,
      columns: (rightOrderPropagation.orderBy ?? [])
        .map(
          (term, index): SelectSqlColumn => ({
            as: orderingColumnAlias(
              (joinQuery.sql.orderBy ?? []).length + index
            ),
            expr: term.expr,
          })
        )
        .concat(joinQuery.sql.columns),
      orderBy:
        joinQuery.sql.orderBy || rightOrderPropagation.orderBy
          ? [
              ...(joinQuery.sql.orderBy ?? []),
              ...(rightOrderPropagation.orderBy ?? []),
            ]
          : undefined,
    },
    joins: joinQuery.joins,
  };
}

export function compileExpr(
  expr: Expr<any>,
  options?: CompilationOptions
): Sql {
  const {sql, joins} = _compileExpr(
    expr,
    new CompilationContext(options ?? {})
  );

  if (joins.length > 0) {
    throw new Error('loose joins are not allowed after expr compilation');
  }

  return sql;
}

interface Join {
  readonly type: 'left' | 'inner';
  readonly condition: Sql;
  readonly right: QuerySql;
  readonly rightAlias: string;
  readonly rootAlias: string;
}

interface CompilationResult<T = Sql> {
  readonly sql: T;
  readonly joins: readonly Join[];
}

type ExprCompilationResult = CompilationResult<Sql>;

function _compileExpr(
  expr: Expr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  return expr.visit({
    binary: x => compileBinaryExpr(x, ctx),
    unary: x => compileUnaryExpr(x, ctx),
    literal: x => compileLiteralExpr(x, ctx),
    case: x => compileCaseExpr(x, ctx),
    locator: x => compileScalarLocatorExpr(x, ctx),
    queryTerminator: x => _compileQueryTerminatorExpr(x, ctx),
    func: x => compileFuncExpr(x, ctx),
    sql: x => compileSqlExpr(x, ctx),
  });
}

function compileBinaryExpr(
  expr: BinaryExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  const lhs = _compileExpr(expr.lhs, ctx);
  const rhs = _compileExpr(expr.rhs, ctx);

  const lhsProj = expr.lhs.projection();
  const rhsProj = expr.rhs.projection();

  assert(
    lhsProj.type === 'scalar' && rhsProj.type === 'scalar',
    'binary operators can only be applied to scalar values'
  );

  const nullable = lhsProj.scalarType.nullable || rhsProj.scalarType.nullable;

  let naiveSql: Sql = {
    type: 'binary',
    op: expr.op,
    lhs: lhs.sql,
    rhs: rhs.sql,
  };
  if (binaryOpIsLogical(expr.op) && nullable) {
    naiveSql = {
      type: 'func',
      func: 'coalesce',
      args: [
        naiveSql,
        {
          type: 'literal',
          literal: {
            type: {
              type: 'boolean',
              nullable: false,
            },
            value: false,
          },
          parameter: false,
        },
      ],
    };
  }

  if (expr.op === '/') {
    return {
      sql: {
        type: 'binary',
        op: expr.op,
        lhs: {
          type: 'func',
          func: 'to_float32',
          args: [lhs.sql],
        },
        rhs: rhs.sql,
      },
      joins: [...lhs.joins, ...rhs.joins],
    };
  }

  if (expr.op === '<<' || expr.op === '>>') {
    return {
      sql: {
        type: 'binary',
        op: expr.op,
        lhs: {
          type: 'func',
          func: 'to_int32',
          args: [lhs.sql],
        },
        rhs: {
          type: 'func',
          func: 'to_int32',
          args: [rhs.sql],
        },
      },
      joins: [...lhs.joins, ...rhs.joins],
    };
  }

  if (
    expr.op === '==' &&
    lhsProj.scalarType.nullable &&
    rhsProj.scalarType.nullable
  ) {
    const lhsNullRhsNull: BinarySql = {
      type: 'binary',
      op: 'and',
      lhs: {
        type: 'unary',
        op: 'is_null',
        inner: lhs.sql,
      },
      rhs: {
        type: 'unary',
        op: 'is_null',
        inner: rhs.sql,
      },
    };

    return {
      sql: {
        type: 'binary',
        op: 'or',
        lhs: lhsNullRhsNull,
        rhs: naiveSql,
      },
      joins: [...lhs.joins, ...rhs.joins],
    };
  }

  if (expr.op === '!=' && nullable) {
    const lhsNullRhsNotNull: Sql = {
      type: 'binary',
      op: 'and',
      lhs: lhsProj.scalarType.nullable
        ? {
            type: 'unary',
            op: 'is_null',
            inner: lhs.sql,
          }
        : falseLiteral,
      rhs: rhsProj.scalarType.nullable
        ? {
            type: 'unary',
            op: 'is_not_null',
            inner: rhs.sql,
          }
        : trueLiteral,
    };

    const lhsNotNullRhsNull: Sql = {
      type: 'binary',
      op: 'and',
      lhs: lhsProj.scalarType.nullable
        ? {
            type: 'unary',
            op: 'is_not_null',
            inner: lhs.sql,
          }
        : trueLiteral,
      rhs: rhsProj.scalarType.nullable
        ? {
            type: 'unary',
            op: 'is_null',
            inner: rhs.sql,
          }
        : falseLiteral,
    };

    return {
      sql: {
        type: 'binary',
        op: 'or',
        lhs: {
          type: 'binary',
          op: 'or',
          lhs: lhsNullRhsNotNull,
          rhs: lhsNotNullRhsNull,
        },
        rhs: naiveSql,
      },
      joins: [...lhs.joins, ...rhs.joins],
    };
  }

  return {
    sql: naiveSql,
    joins: [...lhs.joins, ...rhs.joins],
  };
}

function compileUnaryExpr(
  expr: UnaryExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  const {sql: inner, joins} = _compileExpr(expr.inner, ctx);

  let resultSql: Sql = {
    type: 'unary',
    inner,
    op: expr.op,
  };

  const proj = expr.inner.projection();
  assert(
    proj.type === 'scalar',
    'unary operations can only be applied to scalar values'
  );

  if (expr.op === '!' && proj.scalarType.nullable) {
    resultSql = {
      type: 'binary',
      op: 'or',
      lhs: {
        type: 'unary',
        op: 'is_null',
        inner: inner,
      },
      rhs: resultSql,
    };
  }

  return {
    sql: resultSql,
    joins,
  };
}

function compileCaseExpr(
  expr: CaseExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  const subject = _compileExpr(expr.subject, ctx);
  const fallback = _compileExpr(expr.fallback, ctx);
  const joins: Join[] = [...subject.joins, ...fallback.joins];

  const whens: CaseSqlWhen[] = [];
  for (const when of expr.whens) {
    const condition = _compileExpr(when.condition, ctx);
    const result = _compileExpr(when.result, ctx);

    joins.push(...condition.joins, ...result.joins);
    whens.push({condition: condition.sql, result: result.sql});
  }

  return {
    sql: {
      type: 'case',
      subject: subject.sql,
      whens: whens,
      fallback: fallback.sql,
    },
    joins,
  };
}

function compileObjectLocatorExpr(
  locator: LocatorExpr<any>,
  ctx: CompilationContext
): CompilationResult<AliasSql> {
  const rootAlias = ctx.getAlias(locator.root);

  const joins: Join[] = [];

  const rootProj = locator.root.projection;

  assert(rootProj.type === 'object', 'cannot locate item in scalar projection');

  let childAlias = locator.root;
  let rollingRefs = rootProj.refs;
  for (const part of locator.path) {
    const ref = rollingRefs.find(x => arrayEqual(x.path, part));
    assert(ref !== undefined);
    const parentAlias = new QuerySource({
      type: 'query',
      query: ref.parent(),
    });
    const condition = _compileExpr(
      Expr.from(
        ref.condition(createHandle(parentAlias), createHandle(childAlias))
      ),
      ctx
    );
    joins.push(...condition.joins.map(x => ({...x, rootAlias})));
    const right = _compileQuery(ref.parent(), ctx);
    joins.push(...right.joins);
    joins.push({
      type: ref.nullable ? 'left' : 'inner',
      right: right.sql,
      rightAlias: ctx.getAlias(parentAlias),
      rootAlias,
      condition: condition.sql,
    });

    rollingRefs = match(ref.parent().projection)
      .with({type: 'scalar'}, () => [])
      .with({type: 'object'}, x => x.refs)
      .exhaustive();
    childAlias = parentAlias;
  }

  return {
    sql: {type: 'alias', name: ctx.getAlias(childAlias)},
    joins,
  };
}

function compileScalarLocatorExpr(
  locator: LocatorExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  if (locator.path.length === 0) {
    return {
      sql: {
        type: 'lookup',
        subject: {
          type: 'alias',
          name: ctx.getAlias(locator.root),
        },
        prop: SCALAR_COLUMN_ALIAS,
      },
      joins: [],
    };
  }

  const {sql: subject, joins} = compileObjectLocatorExpr(locator.pop(), ctx);

  // safety: checked at the start of the function that length !== 0
  const leafName = locator.path[locator.path.length - 1]!;

  return {
    sql: {
      type: 'lookup',
      subject,
      // at least one element (checked at the beginning of the function),
      // so safe get take the last
      prop: serializePropPath(leafName),
    },
    joins,
  };
}

function compileFuncExpr(
  expr: FuncExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  const args = expr.args.map(x => _compileExpr(x, ctx));

  if (expr.func === 'to_string') {
    const proj = expr.args[0].projection();
    assert(proj.type === 'scalar');
    if (proj.scalarType.type === 'boolean') {
      return {
        sql: {
          type: 'case',
          whens: [
            {
              condition: {
                type: 'literal',
                literal: inferLiteral(true),
                parameter: false,
              },
              result: {
                type: 'literal',
                literal: inferLiteral('true'),
                parameter: false,
              },
            },
            {
              condition: {
                type: 'literal',
                literal: inferLiteral(false),
                parameter: false,
              },
              result: {
                type: 'literal',
                literal: inferLiteral('false'),
                parameter: false,
              },
            },
          ],
          fallback: {
            type: 'func',
            func: expr.func,
            args: args.map(x => x.sql),
          },
          subject: args[0].sql,
        },
        joins: args.flatMap(x => x.joins),
      };
    }
  }

  if (expr.func === 'substring') {
    return {
      sql: {
        type: 'func',
        func: expr.func,
        // PostgreSQL doesn't accept bigint as an index for substr
        args: args.map((x, idx) =>
          idx === 0 ? x.sql : {type: 'func', func: 'to_int32', args: [x.sql]}
        ),
      },
      joins: args.flatMap(x => x.joins),
    };
  }

  return {
    sql: {
      type: 'func',
      func: expr.func,
      args: args.map(x => x.sql),
    },
    joins: args.flatMap(x => x.joins),
  };
}

function compileLiteralExpr(
  expr: LiteralExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  return {
    sql: {
      type: 'literal',
      literal: expr.literal,
      parameter: ctx.parameters,
    },
    joins: [],
  };
}

function compileSqlExpr(
  expr: SqlExpr<any>,
  ctx: CompilationContext
): ExprCompilationResult {
  const args = expr.sql.args.map((arg): ExprCompilationResult => {
    if (arg instanceof Expr) {
      return _compileExpr(arg, ctx);
    }

    return {
      sql: {
        type: 'literal',
        literal: inferLiteral(arg),
        parameter: ctx.parameters,
      },
      joins: [],
    };
  });
  return {
    sql: {
      type: 'raw',
      src: expr.sql.src,
      args: args.map(x => x.sql),
    },
    joins: args.flatMap(x => x.joins),
  };
}

function _compileQueryTerminatorExpr(
  expr: QueryTerminatorExpr<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return match(expr)
    .with({terminator: 'size'}, () => compileCountTerminator(expr.query, ctx))
    .with({terminator: 'first'}, () => compileFirstTerminator(expr.query, ctx))
    .with({terminator: 'empty'}, () => compileEmptyTerminator(expr.query, ctx))
    .with({terminator: 'max'}, () => compileMaxTerminator(expr.query, ctx))
    .with({terminator: 'mean'}, () => compileMeanTerminator(expr.query, ctx))
    .with({terminator: 'min'}, () => compileMinTerminator(expr.query, ctx))
    .with({terminator: 'some'}, () => compileSomeTerminator(expr.query, ctx))
    .with({terminator: 'sum'}, () => compileSumTerminator(expr.query, ctx))
    .exhaustive();
}

export const aggregationFuncs = ['avg', 'min', 'max', 'sum', 'count'] as const;

function compileAggregationTerminator(
  query: Query<any>,
  // nit: move to separate type
  func: (typeof aggregationFuncs)[number],
  ctx: CompilationContext
): QueryCompilationResult {
  assert(
    query.projection.type === 'scalar',
    'terminator can only be applied to queries with scalar projections'
  );
  const {sql: querySql, joins} = _compileQuery(query, ctx);
  const alias = new QuerySource({type: 'query', query: query});

  return {
    sql: {
      type: 'select',
      columns: [
        {
          expr: {
            type: 'func',
            func,
            args: [
              func === 'count'
                ? {
                    type: 'literal',
                    literal: inferLiteral(1),
                    parameter: false,
                  }
                : {
                    type: 'lookup',
                    subject: {
                      type: 'alias',
                      name: ctx.getAlias(alias),
                    },
                    prop: SCALAR_COLUMN_ALIAS,
                  },
            ],
          },
          as: SCALAR_COLUMN_ALIAS,
        },
      ],
      from: {
        type: 'query',
        as: ctx.getAlias(alias),
        query: querySql,
      },
      joins: [],
      distinct: undefined,
      groupBy: undefined,
      having: undefined,
      limit: undefined,
      offset: undefined,
      orderBy: undefined,
      where: undefined,
    },
    joins,
  };
}

function compileCountTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileAggregationTerminator(
    query.map(() => 1),
    'count',
    ctx
  );
}

function compileMaxTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileAggregationTerminator(query, 'max', ctx);
}

function compileMeanTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileAggregationTerminator(query, 'avg', ctx);
}

function compileMinTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileAggregationTerminator(query, 'min', ctx);
}

function compileSumTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  return compileAggregationTerminator(query, 'sum', ctx);
}

function compileEmptyTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: inner, joins} = _compileQuery(query, ctx);
  return {
    sql: {
      type: 'select',
      columns: [
        {
          as: 'value',
          expr: {
            type: 'unary',
            op: 'not_exists',
            inner,
          },
        },
      ],
      distinct: undefined,
      from: undefined,
      groupBy: undefined,
      having: undefined,
      joins: [],
      limit: undefined,
      offset: undefined,
      orderBy: undefined,
      where: undefined,
    },
    joins,
  };
}

function compileSomeTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql: inner, joins} = _compileQuery(query, ctx);

  return {
    sql: {
      type: 'select',
      columns: [
        {
          as: 'value',
          expr: {
            type: 'unary',
            op: 'exists',
            inner,
          },
        },
      ],
      distinct: undefined,
      from: undefined,
      groupBy: undefined,
      having: undefined,
      joins: [],
      limit: undefined,
      offset: undefined,
      orderBy: undefined,
      where: undefined,
    },
    joins,
  };
}

function compileFirstTerminator(
  query: Query<any>,
  ctx: CompilationContext
): QueryCompilationResult {
  const {sql, joins} = _compileQuery(query.take(1), ctx);
  assert(sql.type === 'select');

  return {
    sql: {
      ...sql,
      columns: sql.columns.filter(column => !isSystemColumn(column.as)),
    },
    joins,
  };
}
