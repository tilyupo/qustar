export {Connector, SqlCommand, cmd, materialize} from './connector.js';
export {compileQuery} from './expr/compiler.js';
export {Expr, QueryTerminatorExpr} from './expr/expr.js';
export {Query} from './expr/query.js';
export {sql} from './expr/sql.js';
export {SingleLiteralValue} from './literal.js';
export {renderMySql} from './render/mysql.js';
export {renderPostgreSql} from './render/postgresql.js';
export {convertToArgument} from './render/sql.js';
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
} from './types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function interpretQuery(...args: any[]): any {
  throw new Error('todo: implement interpretQuery');
}
