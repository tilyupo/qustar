import {SqlCommand} from '../connector.js';
import {JoinType, OrderByNulls, OrderByType} from '../expr/query.js';
import {Literal} from '../literal.js';

export type Sql =
  | AliasSql
  | BinarySql
  | CaseSql
  | CombinationSql
  | LiteralSql
  | LookupSql
  | FuncSql
  | SelectSql
  | UnarySql
  | RawSql
  | RowNumberSql;

export type QuerySql = SelectSql | CombinationSql;

export interface GenericSql<TType extends string> {
  readonly type: TType;
}

// === row number ===

export interface RowNumberSql extends GenericSql<'row_number'> {
  readonly orderBy: readonly SqlOrderBy[] | undefined;
}

// === func ===

export type FuncSql = GenericFuncSql<
  | 'substring'
  | 'concat'
  | 'max'
  | 'min'
  | 'avg'
  | 'count'
  | 'sum'
  | 'to_string'
  | 'to_int'
  | 'to_float'
  | 'coalesce'
  | 'length'
>;

export interface GenericFuncSql<TFunc extends string>
  extends GenericSql<'func'> {
  readonly func: TFunc;
  readonly args: readonly Sql[];
}

// === literal ===

export interface LiteralSql extends GenericSql<'literal'> {
  readonly literal: Literal;
  readonly parameter: boolean;
}

// === unary ===

export type UnarySqlOp =
  | '!'
  | '+'
  | '-'
  | '~'
  | 'exists'
  | 'not_exists'
  | 'is_null'
  | 'is_not_null';

export type UnarySql = GenericUnarySql<UnarySqlOp>;

export interface GenericUnarySql<TVariant extends string>
  extends GenericSql<'unary'> {
  readonly op: TVariant;
  readonly inner: Sql;
}

// === binary ===

export type BinarySqlOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '<<'
  | '>>'
  | '&'
  | '|'
  | '^'
  | 'or'
  | 'and'
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | '!='
  | 'like'
  | 'in';

export type BinarySql = GenericBinarySql<BinarySqlOp>;

export interface GenericBinarySql<TVariant extends string>
  extends GenericSql<'binary'> {
  readonly op: TVariant;
  readonly lhs: Sql;
  readonly rhs: Sql;
}

// === case ===

export interface CaseSql extends GenericSql<'case'> {
  readonly subject: Sql;
  readonly whens: readonly CaseSqlWhen[];
  readonly fallback: Sql;
}

export interface CaseSqlWhen {
  readonly condition: Sql;
  readonly result: Sql;
}

// === unary ===

export interface AliasSql extends GenericSql<'alias'> {
  readonly name: string;
}

// === path ===

export interface LookupSql extends GenericSql<'lookup'> {
  readonly subject: Sql;
  readonly prop: string;
}

// === raw ===

export interface RawSql extends GenericSql<'raw'> {
  readonly src: string;
  readonly args: Literal[];
}

// === select ===

export const EMPTY_SELECT: SelectSql = {
  columns: [],
  distinct: undefined,
  from: undefined,
  groupBy: undefined,
  having: undefined,
  joins: [],
  limit: undefined,
  offset: undefined,
  orderBy: undefined,
  type: 'select',
  where: undefined,
};

export interface SelectSql extends GenericSql<'select'> {
  readonly distinct: true | undefined;
  readonly columns: readonly SelectSqlColumn[];
  readonly from: SqlSource | undefined;
  readonly joins: readonly SelectSqlJoin[];
  readonly where: Sql | undefined;
  readonly groupBy: readonly Sql[] | undefined;
  readonly having: Sql | undefined;
  readonly orderBy: readonly SqlOrderBy[] | undefined;
  readonly limit: number | undefined;
  readonly offset: number | undefined;
}

// select select

export interface GenericSelectSqlColumn<TType extends string> {
  readonly type: TType;
}

export interface SelectSqlSingleColumn
  extends GenericSelectSqlColumn<'single'> {
  readonly expr: Sql;
  readonly as: string;
}

export interface SelectSqlWildcardColumn
  extends GenericSelectSqlColumn<'wildcard'> {
  readonly subject: AliasSql;
}

export type SelectSqlColumn = SelectSqlSingleColumn | SelectSqlWildcardColumn;

// select from

export interface GenericSelectSqlFrom<TType extends string> {
  readonly type: TType;
  readonly as: string;
}

export interface SelectSqlFromQuery extends GenericSelectSqlFrom<'query'> {
  readonly query: QuerySql;
}

export interface SelectSqlFromTable extends GenericSelectSqlFrom<'table'> {
  readonly table: string;
}

export interface SelectSqlFromSql extends GenericSelectSqlFrom<'sql'> {
  readonly command: SqlCommand;
}

export type SqlSource =
  | SelectSqlFromTable
  | SelectSqlFromQuery
  | SelectSqlFromSql;

// select join

export interface SelectSqlJoin {
  readonly right: SqlSource;
  readonly condition: Sql | undefined;
  readonly type: JoinType;
  readonly lateral: boolean;
}

// order by

export interface SqlOrderBy {
  readonly type: OrderByType;
  readonly nulls: OrderByNulls | undefined;
  readonly expr: Sql;
}

// === combination ===

export type SqlCombinationType = 'union' | 'union_all' | 'intersect' | 'except';

export interface CombinationSql extends GenericSql<'combination'> {
  readonly combType: SqlCombinationType;
  readonly lhs: QuerySql;
  readonly rhs: QuerySql;
}

// literals

export const oneLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'i32', nullable: false},
    value: 1,
  },
};

export const constStrLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'text', nullable: false},
    value: 'const',
  },
};

export const trueLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'boolean', nullable: false},
    value: true,
  },
};

export const falseLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'boolean', nullable: false},
    value: false,
  },
};

export const zeroLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'i32', nullable: false},
    value: 0,
  },
};
