export {Connector, SqlCommand, materialize} from './connector.js';
export {Literal, LiteralValue, SingleLiteralValue} from './literal.js';
export {compileQuery} from './query/compiler.js';
export {Expr, QueryTerminatorExpr} from './query/expr.js';
export {Query} from './query/query.js';
export {sql} from './query/sql.js';
export {renderMysql} from './render/mysql.js';
export {renderPostgresql} from './render/postgresql.js';
export {renderSqlite} from './render/sqlite.js';
export {optimize} from './sql/optimizer.js';
export {
  AliasSql,
  BinarySql,
  BinarySqlOp,
  CaseSql,
  CaseSqlWhen,
  CombinationSql,
  FuncSql,
  GenericBinarySql,
  GenericFuncSql,
  GenericSelectSqlFrom,
  GenericSql,
  GenericUnarySql,
  LiteralSql,
  LookupSql,
  QuerySql,
  RawSql,
  RowNumberSql,
  SelectSql,
  SelectSqlColumn,
  SelectSqlFromQuery,
  SelectSqlFromSql,
  SelectSqlFromTable,
  SelectSqlJoin,
  Sql,
  SqlCombinationType,
  SqlOrderBy,
  SqlSource,
  UnarySql,
  UnarySqlOp,
} from './sql/sql.js';
export {
  FilterFn,
  JoinFilterFn,
  MapQueryFn,
  MapScalarArrayFn,
  MapScalarFn,
  MapValueFn,
  Mapping,
  ScalarMapping,
} from './types/query.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function interpretQuery(...args: any[]): any {
  throw new Error('todo: implement interpretQuery');
}
