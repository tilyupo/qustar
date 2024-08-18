import {match} from 'ts-pattern';
import {
  AliasSql,
  BinarySql,
  CaseSql,
  CombinationSql,
  ExprSql,
  FuncSql,
  LiteralSql,
  LookupSql,
  QuerySql,
  RawSql,
  RowNumberSql,
  SelectSql,
  SelectSqlColumn,
  SelectSqlJoin,
  SqlSource,
  UnarySql,
} from './sql.js';

function idMapper<T>(x: T): T {
  return x;
}

export const ID_SQL_MAPPER: SqlMapper = {
  alias: idMapper,
  binary: idMapper,
  case: idMapper,
  combination: idMapper,
  func: idMapper,
  literal: idMapper,
  lookup: idMapper,
  select: idMapper,
  unary: idMapper,
  source: idMapper,
  column: idMapper,
  join: idMapper,
  raw: idMapper,
  rowNumber: idMapper,
};

interface QuerySqlMapper {
  combination: (sql: CombinationSql) => QuerySql;
  select: (sql: SelectSql) => SelectSql;
}

interface SqlMapper extends QuerySqlMapper {
  func: (sql: FuncSql) => ExprSql;
  alias: (sql: AliasSql) => AliasSql;
  binary: (sql: BinarySql) => ExprSql;
  case: (sql: CaseSql) => ExprSql;
  literal: (sql: LiteralSql) => ExprSql;
  lookup: (sql: LookupSql) => ExprSql;
  unary: (sql: UnarySql) => ExprSql;
  raw: (sql: RawSql) => ExprSql;
  rowNumber: (sql: RowNumberSql) => ExprSql;
  source: (sql: SqlSource) => SqlSource;
  column: (
    sql: SelectSqlColumn
  ) => SelectSqlColumn | readonly SelectSqlColumn[];
  join: (sql: SelectSqlJoin) => SelectSqlJoin | readonly SelectSqlJoin[];
}

export function mapQuery(sql: QuerySql, mapper: SqlMapper): QuerySql {
  return match(sql)
    .with({type: 'combination'}, x => mapCombination(x, mapper))
    .with({type: 'select'}, x => mapSelect(x, mapper))
    .exhaustive();
}

export function mapSql(sql: ExprSql, mapper: SqlMapper): ExprSql {
  return match(sql)
    .with({type: 'func'}, x => mapFunc(x, mapper))
    .with({type: 'alias'}, x => mapAlias(x, mapper))
    .with({type: 'binary'}, x => mapBinary(x, mapper))
    .with({type: 'case'}, x => mapCase(x, mapper))
    .with({type: 'combination'}, x => mapCombination(x, mapper))
    .with({type: 'select'}, x => mapSelect(x, mapper))
    .with({type: 'literal'}, x => mapLiteral(x, mapper))
    .with({type: 'lookup'}, x => mapLookup(x, mapper))
    .with({type: 'unary'}, x => mapUnary(x, mapper))
    .with({type: 'raw'}, x => mapRaw(x, mapper))
    .with({type: 'row_number'}, x => mapRowNumber(x, mapper))
    .exhaustive();
}

function mapFunc(sql: FuncSql, mapper: SqlMapper): ExprSql {
  return mapper.func({
    type: sql.type,
    args: sql.args.map(x => mapSql(x, mapper)),
    func: sql.func,
  });
}

function mapAlias(sql: AliasSql, mapper: SqlMapper): ExprSql {
  return mapper.alias(sql);
}

function mapBinary(sql: BinarySql, mapper: SqlMapper): ExprSql {
  return mapper.binary({
    type: sql.type,
    op: sql.op,
    lhs: mapSql(sql.lhs, mapper),
    rhs: mapSql(sql.rhs, mapper),
  });
}

function mapCase(sql: CaseSql, mapper: SqlMapper): ExprSql {
  return mapper.case({
    type: sql.type,
    subject: mapSql(sql.subject, mapper),
    whens: sql.whens.map(x => ({
      condition: mapSql(x.condition, mapper),
      result: mapSql(x.result, mapper),
    })),
    fallback: mapSql(sql.fallback, mapper),
  });
}

function mapCombination(sql: CombinationSql, mapper: SqlMapper): QuerySql {
  return mapper.combination({
    type: sql.type,
    combType: sql.combType,
    lhs: mapQuery(sql.lhs, mapper),
    rhs: mapQuery(sql.rhs, mapper),
  });
}

function mapLiteral(sql: LiteralSql, mapper: SqlMapper): ExprSql {
  return mapper.literal(sql);
}

function mapLookup(sql: LookupSql, mapper: SqlMapper): ExprSql {
  return mapper.lookup({
    type: sql.type,
    prop: sql.prop,
    subject: mapSql(sql.subject, mapper),
  });
}

function mapSqlSource(source: SqlSource, mapper: SqlMapper): SqlSource {
  return mapper.source(
    match(source)
      .with({type: 'table'}, x => x)
      .with(
        {type: 'query'},
        (x): SqlSource => ({
          type: x.type,
          as: x.as,
          query: mapQuery(x.query, mapper),
        })
      )
      .with(
        {type: 'sql'},
        (source): SqlSource => ({
          type: source.type,
          as: source.as,
          sql: {
            type: source.sql.type,
            src: source.sql.src,
            args: source.sql.args.map(arg => mapSql(arg, mapper)),
          },
        })
      )
      .exhaustive()
  );
}

export function mapSelect(sql: SelectSql, mapper: SqlMapper): SelectSql {
  return mapper.select({
    type: sql.type,
    columns: sql.columns
      .map(column => ({
        as: column.as,
        expr: mapSql(column.expr, mapper),
      }))
      .flatMap(mapper.column),
    from: sql.from ? mapSqlSource(sql.from, mapper) : undefined,
    joins: sql.joins
      .map(join => ({
        type: join.type,
        condition: join.condition && mapSql(join.condition, mapper),
        right: mapSqlSource(join.right, mapper),
        lateral: join.lateral,
      }))
      .flatMap(mapper.join),
    distinct: sql.distinct,
    groupBy:
      sql.groupBy === undefined
        ? undefined
        : sql.groupBy.map(x => mapSql(x, mapper)),
    having: sql.having === undefined ? undefined : mapSql(sql.having, mapper),
    where: sql.where === undefined ? undefined : mapSql(sql.where, mapper),
    orderBy:
      sql.orderBy === undefined
        ? undefined
        : sql.orderBy.map(x => ({
            expr: mapSql(x.expr, mapper),
            type: x.type,
          })),
    limit: sql.limit,
    offset: sql.offset,
  });
}

function mapUnary(sql: UnarySql, mapper: SqlMapper): ExprSql {
  return mapper.unary({
    type: sql.type,
    op: sql.op,
    inner: mapSql(sql.inner, mapper),
  });
}

function mapRaw(sql: RawSql, mapper: SqlMapper): ExprSql {
  return mapper.raw({
    type: sql.type,
    src: sql.src,
    args: sql.args.map(x => mapSql(x, mapper)),
  });
}

function mapRowNumber(sql: RowNumberSql, mapper: SqlMapper): ExprSql {
  return mapper.rowNumber({
    type: sql.type,
    orderBy: sql.orderBy
      ? sql.orderBy.map(x => ({
          type: x.type,
          expr: mapSql(x.expr, mapper),
        }))
      : undefined,
  });
}
