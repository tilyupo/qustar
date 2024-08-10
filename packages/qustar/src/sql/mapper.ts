import {match} from 'ts-pattern';
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
  SelectSqlColumn,
  SelectSqlJoin,
  Sql,
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
  func: (sql: FuncSql) => Sql;
  alias: (sql: AliasSql) => AliasSql;
  binary: (sql: BinarySql) => Sql;
  case: (sql: CaseSql) => Sql;
  literal: (sql: LiteralSql) => Sql;
  lookup: (sql: LookupSql) => Sql;
  unary: (sql: UnarySql) => Sql;
  raw: (sql: RawSql) => Sql;
  rowNumber: (sql: RowNumberSql) => Sql;
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

export function mapSql(sql: Sql, mapper: SqlMapper): Sql {
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

function mapFunc(sql: FuncSql, mapper: SqlMapper): Sql {
  return mapper.func({
    type: sql.type,
    args: sql.args.map(x => mapSql(x, mapper)),
    func: sql.func,
  });
}

function mapAlias(sql: AliasSql, mapper: SqlMapper): Sql {
  return mapper.alias(sql);
}

function mapBinary(sql: BinarySql, mapper: SqlMapper): Sql {
  return mapper.binary({
    type: sql.type,
    op: sql.op,
    lhs: mapSql(sql.lhs, mapper),
    rhs: mapSql(sql.rhs, mapper),
  });
}

function mapCase(sql: CaseSql, mapper: SqlMapper): Sql {
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

function mapLiteral(sql: LiteralSql, mapper: SqlMapper): Sql {
  return mapper.literal(sql);
}

function mapLookup(sql: LookupSql, mapper: SqlMapper): Sql {
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
            nulls: x.nulls,
          })),
    limit: sql.limit,
    offset: sql.offset,
  });
}

function mapUnary(sql: UnarySql, mapper: SqlMapper): UnarySql {
  return {
    type: sql.type,
    op: sql.op,
    inner: mapSql(sql.inner, mapper),
  };
}

function mapRaw(sql: RawSql, mapper: SqlMapper): Sql {
  return mapper.raw({
    type: sql.type,
    src: sql.src,
    args: sql.args.map(x => mapSql(x, mapper)),
  });
}

function mapRowNumber(sql: RowNumberSql, mapper: SqlMapper): Sql {
  return mapper.rowNumber({
    type: sql.type,
    orderBy: sql.orderBy
      ? sql.orderBy.map(x => ({
          type: x.type,
          nulls: x.nulls,
          expr: mapSql(x.expr, mapper),
        }))
      : undefined,
  });
}
