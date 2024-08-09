import {match} from 'ts-pattern';
import {SqlCommand, cmd} from '../connector.js';
import {isNumeric} from '../expr/expr.js';
import {
  ArrayLiteral,
  DateLiteral,
  Literal,
  LiteralValue,
  SingleLiteral,
  assertArrayLiteral,
  assertSingleLiteral,
  inferLiteral,
} from '../literal.js';
import {
  AliasSql,
  BinarySql,
  CaseSql,
  CombinationSql,
  FuncSql,
  LiteralSql,
  LookupSql,
  QuerySql,
  RawSql,
  RowNumberSql,
  SelectSql,
  Sql,
  SqlOrderBy,
  UnarySql,
} from '../sql/sql.js';
import {assertNever, formatDate, formatDateTime, indent} from '../utils.js';

export function convertToArgument(literal: Literal): LiteralValue {
  if (literal.type.type === 'date') {
    return formatDate((literal as DateLiteral).value);
  } else {
    return literal.value;
  }
}
class RenderingContext {
  constructor(readonly options: SqlRenderingOptions) {}

  escapeId(id: string): string {
    return this.options.escapeId(id);
  }
}

export interface SqlRenderingOptions {
  pretty?: boolean;
  emulateArrayLiteralParam?: boolean;
  emulateXor?: boolean;
  escapeId: (id: string) => string;
}

export function renderSql(
  sql: QuerySql,
  options: SqlRenderingOptions
): SqlCommand {
  return render(sql, new RenderingContext(options ?? {}));
}

function render(sql: Sql, ctx: RenderingContext): SqlCommand {
  return match(sql)
    .with({type: 'func'}, x => renderFunc(x, ctx))
    .with({type: 'alias'}, x => renderAlias(x, ctx))
    .with({type: 'binary'}, x => renderBinary(x, ctx))
    .with({type: 'case'}, x => renderCase(x, ctx))
    .with({type: 'combination'}, x => renderCombination(x, ctx))
    .with({type: 'literal'}, x => renderLiteral(x, ctx))
    .with({type: 'lookup'}, x => renderLookup(x, ctx))
    .with({type: 'select'}, x => renderSelect(x, ctx))
    .with({type: 'unary'}, x => renderUnary(x, ctx))
    .with({type: 'raw'}, x => renderRaw(x, ctx))
    .with({type: 'row_number'}, x => renderRowNumber(x, ctx))
    .exhaustive();
}

function renderFunc(sql: FuncSql, ctx: RenderingContext): SqlCommand {
  if (sql.func === 'to_int') {
    return cmd`CAST(${render(sql.args[0], ctx)} as INT)`;
  } else if (sql.func === 'to_float') {
    return cmd`CAST(${render(sql.args[0], ctx)} as REAL)`;
  } else if (sql.func === 'to_string') {
    return cmd`CAST(${render(sql.args[0], ctx)} as TEXT)`;
  } else {
    const {fn, args} = match(sql.func)
      .with('substring', () => ({
        // substr(start, length)
        fn: 'substr',
        args: [
          render(sql.args[0], ctx),
          // start = input_start + 1 --  SQLite string indexing starts with 1, not 0
          render(
            {
              type: 'binary',
              op: '+',
              lhs: sql.args[1],
              rhs: {
                type: 'literal',
                literal: inferLiteral(1),
                parameter: false,
              },
            },
            ctx
          ),
          // end = input_end - input_start
          render(
            {
              type: 'binary',
              op: '-',
              lhs: sql.args[2],
              rhs: sql.args[1],
            },
            ctx
          ),
        ],
      }))
      .with('avg', () => ({fn: 'AVG', args: sql.args.map(x => render(x, ctx))}))
      .with('count', () => ({
        fn: 'COUNT',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('max', () => ({fn: 'MAX', args: sql.args.map(x => render(x, ctx))}))
      .with('min', () => ({fn: 'MIN', args: sql.args.map(x => render(x, ctx))}))
      .with('sum', () => ({fn: 'SUM', args: sql.args.map(x => render(x, ctx))}))
      .with('coalesce', () => ({
        fn: 'COALESCE',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('concat', () => ({
        fn: 'concat',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('length', () => ({
        fn: 'length',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .exhaustive();

    return cmd`${fn}(${SqlCommand.join(args, ', ')})`;
  }
}

function renderAlias(sql: AliasSql, ctx: RenderingContext): SqlCommand {
  return {
    src: ctx.escapeId(sql.name),
    args: [],
  };
}

function renderWrap(sql: Sql, ctx: RenderingContext): SqlCommand {
  const result = render(sql, ctx);
  if (
    sql.type === 'lookup' ||
    sql.type === 'alias' ||
    sql.type === 'unary' ||
    sql.type === 'func' ||
    sql.type === 'literal' ||
    sql.type === 'case'
  ) {
    return result;
  }

  return cmd`(${result})`;
}

function renderBinary(sql: BinarySql, ctx: RenderingContext): SqlCommand {
  const lhs = renderWrap(sql.lhs, ctx);
  const rhs = renderWrap(sql.rhs, ctx);

  if (sql.op === '^' && ctx.options.emulateXor) {
    return cmd`(~(${lhs}&${rhs}))&(${lhs}|${rhs})`;
  }

  const op = match(sql.op)
    .with('and', () => 'AND')
    .with('or', () => 'OR')
    .with('!=', () => '!=')
    .with('<', () => '<')
    .with('<=', () => '<=')
    .with('==', () => '==')
    .with('>', () => '>')
    .with('>=', () => '>=')
    .with('in', () => 'IN')
    .with('like', () => 'LIKE')
    .with('*', () => '*')
    .with('+', () => '+')
    .with('-', () => '-')
    .with('/', () => '/')
    .with('%', () => '%')
    .with('|', () => '|')
    .with('&', () => '&')
    .with('^', () => '^')
    .with('<<', () => '<<')
    .with('>>', () => '>>')
    .exhaustive();

  return cmd`${lhs} ${op} ${rhs}`;
}

function renderUnary(sql: UnarySql, ctx: RenderingContext): SqlCommand {
  const [prefix, op] = match(sql.op)
    .with('!', () => [true, 'NOT'] as const)
    .with('+', () => [true, '+'] as const)
    .with('-', () => [true, '-'] as const)
    .with('~', () => [true, '~'] as const)
    .with('exists', () => [true, 'EXISTS'] as const)
    .with('not_exists', () => [true, 'NOT EXISTS'] as const)
    .with('is_not_null', () => [false, 'IS NOT NULL'] as const)
    .with('is_null', () => [false, 'IS NULL'] as const)
    .exhaustive();

  const inner = renderWrap(sql.inner, ctx);

  return prefix ? cmd`${op} ${inner}` : cmd`${inner} ${op}`;
}

function renderRaw(sql: RawSql, ctx: RenderingContext): SqlCommand {
  const src = [sql.src[0]];
  const args: Literal[] = [];

  for (let i = 1; i < sql.src.length; i += 1) {
    const arg = render(sql.args[i - 1], ctx);
    args.push(...arg.args);
    src.push(`(${arg.src})`);
    src.push(sql.src[i]);
  }

  return {
    src: src.join(''),
    args,
  };
}

function renderRowNumber(sql: RowNumberSql, ctx: RenderingContext): SqlCommand {
  return sql.orderBy === undefined
    ? cmd`ROW_NUMBER() OVER ()`
    : cmd`ROW_NUMBER() OVER (ORDER BY ${renderOrderByTerms(sql.orderBy, ctx)})`;
}

function renderCase(sql: CaseSql, ctx: RenderingContext): SqlCommand {
  const subject = renderWrap(sql.subject, ctx);
  const fallback = renderWrap(sql.fallback, ctx);

  const whens: SqlCommand[] = [];
  for (const when of sql.whens) {
    const condition = renderWrap(when.condition, ctx);
    const result = renderWrap(when.result, ctx);

    whens.push(cmd`WHEN ${condition} THEN ${result}`);
  }

  return cmd`CASE ${subject} ${SqlCommand.join(whens, ' ')} ELSE ${fallback} END`;
}

function renderCombination(
  sql: CombinationSql,
  ctx: RenderingContext
): SqlCommand {
  const op = match(sql)
    .with({combType: 'union'}, () => 'UNION')
    .with({combType: 'union_all'}, () => 'UNION\nALL')
    .with({combType: 'intersect'}, () => 'INTERSECT')
    .with({combType: 'except'}, () => 'EXCEPT')
    .exhaustive();

  return cmd`${render(sql.lhs, ctx)}\n${op}\n${render(sql.rhs, ctx)}`;
}

function renderSingleLiteralInline(literal: SingleLiteral): SqlCommand {
  const command = match(literal)
    .with({type: {type: 'boolean'}}, ({value}) => cmd`${value ? 1 : 0}`)
    .with({type: {type: 'f32'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'f64'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i8'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i16'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i32'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i64'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'u8'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'u16'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'u32'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'u64'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'null'}}, () => cmd`NULL`)
    .with({type: {type: 'date'}}, ({value}) => cmd`'${formatDate(value)}'`)
    .with({type: {type: 'time'}}, () => {
      throw new Error('SQLite does not support time literals');
    })
    .with({type: {type: 'timetz'}}, () => {
      throw new Error('SQLite does not support timetz literals');
    })
    .with(
      {type: {type: 'timestamp'}},
      ({value}) => cmd`'${formatDateTime(value)}'`
    )
    .with({type: {type: 'timestamptz'}}, () => {
      throw new Error('SQLite does not support timestamptz literals');
    })
    .with({type: {type: 'uuid'}}, ({value}) => cmd`'${value}'`)
    .with({type: {type: 'text'}}, ({value}) => cmd`'${value}'`)
    .with({type: {type: 'char'}}, ({value}) => cmd`'${value}'`)
    .with({type: {type: 'dynamic'}}, () => {
      throw new Error('cannot inline scalar dynamic value');
    })
    .exhaustive();

  if (isNumeric(literal.type) || literal.type.type === 'boolean') {
    // we need to add plus to make sure that SQLite treats it as an expression
    // by default it will treat numbers as column indexes in GROUP/ORDER BY context
    return cmd`(0 + ${command})`;
  } else {
    return cmd`${command}`;
  }
}

function renderSingleLiteral(
  literal: SingleLiteral,
  parameter: boolean
): SqlCommand {
  if (parameter) {
    return {
      args: [literal],
      src: '?',
    };
  } else {
    return renderSingleLiteralInline(literal);
  }
}

function renderArrayLiteral(
  literal: ArrayLiteral,
  parameter: boolean,
  ctx: RenderingContext
): SqlCommand {
  if (ctx.options.emulateArrayLiteralParam) {
    const literalQueries = literal.value.map(x =>
      renderSingleLiteral(
        {
          type: literal.type.itemType,
          value: x,
        } as SingleLiteral,
        parameter
      )
    );

    return cmd`(${SqlCommand.join(literalQueries, ', ')})`;
  }

  return {
    args: [literal],
    src: '?',
  };
}

function renderLiteral(
  {literal, parameter}: LiteralSql,
  ctx: RenderingContext
): SqlCommand {
  if (literal.type.type === 'array') {
    // for type check

    assertArrayLiteral(literal);

    return renderArrayLiteral(literal, parameter, ctx);
  } else {
    // for type check
    assertSingleLiteral(literal);

    return renderSingleLiteral(literal, parameter);
  }
}

function renderLookup(sql: LookupSql, ctx: RenderingContext): SqlCommand {
  return cmd`${render(sql.subject, ctx)}.${ctx.escapeId(sql.prop)}`;
}

function indentCommand(
  command: SqlCommand,
  depth: number,
  ctx: RenderingContext
): SqlCommand {
  if (ctx.options.pretty === false) {
    return command;
  }
  return {
    src: indent(command.src, depth),
    args: command.args,
  };
}

function straight(command: SqlCommand): SqlCommand {
  return {
    ...command,
    src: command.src
      .split('\n')
      .map(x => x.trim())
      .join(' '),
  };
}

function renderSelect(sql: SelectSql, ctx: RenderingContext): SqlCommand {
  const columns = SqlCommand.join(
    sql.columns.map((column): SqlCommand => {
      if (column.type === 'single') {
        let expr = straight(render(column.expr, ctx));

        if (
          column.expr.type === 'select' ||
          column.expr.type === 'combination' ||
          column.expr.type === 'raw'
        ) {
          expr = cmd`(${expr})`;
        }

        if (column.expr.type === 'lookup' && column.expr.prop === column.as) {
          return cmd`${expr}`;
        } else {
          return cmd`${expr} AS ${ctx.escapeId(column.as)}`;
        }
      } else if (column.type === 'wildcard') {
        return cmd`${column.subject.name}.*`;
      }

      return assertNever(column, 'invalid column: ' + column);
    }),
    ',\n'
  );
  let select = sql.distinct
    ? cmd`SELECT DISTINCT\n${indentCommand(columns, 1, ctx)}`
    : cmd`SELECT\n${indentCommand(columns, 1, ctx)}`;

  if (sql.from) {
    const from = match(sql.from)
      .with(
        {type: 'query'},
        ({query: queryIR, as: alias}) =>
          cmd`FROM\n  (\n${indentCommand(render(queryIR, ctx), 2, ctx)}\n  ) AS ${ctx.escapeId(alias)}`
      )
      .with(
        {type: 'table'},
        ({table, as: alias}) => cmd`FROM\n  ${table} AS ${ctx.escapeId(alias)}`
      )
      .with(
        {type: 'sql'},
        sql =>
          cmd`FROM\n  (\n${indentCommand(renderRaw(sql.sql, ctx), 2, ctx)}\n  ) AS ${ctx.escapeId(sql.as)}`
      )
      .exhaustive();

    select = cmd`${select}\n${from}`;
  }

  for (const join of sql.joins) {
    let joinType = match(join.type)
      .with('full', () => 'FULL')
      .with('left', () => 'LEFT')
      .with('right', () => 'RIGHT')
      .with('inner', () => 'INNER')
      .exhaustive();

    joinType += ' JOIN';

    if (join.lateral) {
      joinType += ' LATERAL';
    }

    const right = match(join.right)
      .with(
        {type: 'query'},
        right => cmd`(\n${indentCommand(render(right.query, ctx), 2, ctx)}\n  )`
      )
      .with({type: 'table'}, right => cmd`${right.table}`)
      .with(
        {type: 'sql'},
        right =>
          cmd`(\n${indentCommand(renderRaw(right.sql, ctx), 2, ctx)}\n  )`
      )
      .exhaustive();

    select = cmd`${select}\n  ${joinType} ${right} AS ${ctx.escapeId(join.right.as)}`;
    if (join.condition) {
      select = cmd`${select} ON ${straight(render(join.condition, ctx))}`;
    }
  }

  if (sql.where !== undefined) {
    select = cmd`${select}\nWHERE\n  ${straight(render(sql.where, ctx))}`;
  }

  if (sql.groupBy !== undefined) {
    const groupByExpr = SqlCommand.join(
      sql.groupBy.map(expr => render(expr, ctx)),
      ', '
    );
    select = cmd`${select}\nGROUP BY ${straight(groupByExpr)}`;
  }

  if (sql.having !== undefined) {
    select = cmd`${select}\nHAVING ${straight(render(sql.having, ctx))}`;
  }

  if (sql.orderBy !== undefined) {
    select = cmd`${select}\nORDER BY\n  ${renderOrderByTerms(sql.orderBy, ctx)}`;
  }

  if (sql.limit !== undefined) {
    select = cmd`${select}\nLIMIT\n  ${sql.limit}`;
  }

  if (sql.offset !== undefined) {
    select = cmd`${select} OFFSET ${sql.offset}`;
  }

  return cmd`${select}`;
}

function renderOrderByTerms(
  terms: readonly SqlOrderBy[],
  ctx: RenderingContext
): SqlCommand {
  const parts = terms.map(part => {
    const orderByType = match(part.type)
      .with('asc', () => 'ASC')
      .with('desc', () => 'DESC')
      .exhaustive();
    let result = cmd`(${straight(render(part.expr, ctx))}) ${orderByType}`;

    if (part.nulls) {
      const nulls = match(part.nulls)
        .with('first', () => 'NULLS FIRST')
        .with('last', () => 'NULLS LAST')
        .exhaustive();

      result = cmd`${result} ${nulls}`;
    }

    return result;
  });

  return SqlCommand.join(parts, ',\n  ');
}
