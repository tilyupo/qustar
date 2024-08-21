import {Literal} from '../literal.js';
import {JoinType, OrderByType} from '../query/query.js';

export type QuerySql = SelectSql | CombinationSql;

export type ExprSql =
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

export type StmtSql = InsertSql | DeleteSql | UpdateSql;

export type Sql = ExprSql | StmtSql;

export interface GenericSql<TType extends string> {
  readonly type: TType;
}

// === row number ===

export interface RowNumberSql extends GenericSql<'row_number'> {
  readonly orderBy: readonly SqlOrderBy[] | undefined;
}

// === func ===

export type FuncSql = GenericFuncSql<
  | 'lower'
  | 'upper'
  | 'substring'
  | 'concat'
  | 'max'
  | 'min'
  | 'avg'
  | 'count'
  | 'sum'
  | 'to_string'
  | 'to_int32'
  | 'to_float32'
  | 'coalesce'
  | 'length'
>;

export interface GenericFuncSql<TFunc extends string>
  extends GenericSql<'func'> {
  readonly func: TFunc;
  readonly args: readonly ExprSql[];
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
  readonly inner: ExprSql;
}

// === binary ===

export type BinarySqlOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
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
  readonly lhs: ExprSql;
  readonly rhs: ExprSql;
}

// === case ===

export interface CaseSql extends GenericSql<'case'> {
  readonly subject: ExprSql;
  readonly whens: readonly CaseSqlWhen[];
  readonly fallback: ExprSql;
}

export interface CaseSqlWhen {
  readonly condition: ExprSql;
  readonly result: ExprSql;
}

// === unary ===

export interface AliasSql extends GenericSql<'alias'> {
  readonly name: string;
}

// === path ===

export interface LookupSql extends GenericSql<'lookup'> {
  readonly subject: ExprSql;
  readonly prop: string;
}

// === raw ===

export interface RawSql extends GenericSql<'raw'> {
  readonly src: TemplateStringsArray;
  readonly args: ExprSql[];
}

// === insert ===

export interface InsertSql extends GenericSql<'insert'> {
  readonly table: string;
  readonly columns: string[];
  readonly rows: LiteralSql[][];
}

// === delete ===

export interface DeleteSql extends GenericSql<'delete'> {
  readonly table: TableSqlSource;
  readonly where: ExprSql;
}

// === update ===

export interface SqlSet {
  readonly column: string;
  readonly value: ExprSql;
}

export interface UpdateSql extends GenericSql<'update'> {
  readonly table: TableSqlSource;
  readonly set: SqlSet[];
  readonly where: ExprSql;
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
  readonly where: ExprSql | undefined;
  readonly groupBy: readonly ExprSql[] | undefined;
  readonly having: ExprSql | undefined;
  readonly orderBy: readonly SqlOrderBy[] | undefined;
  readonly limit: number | undefined;
  readonly offset: number | undefined;
}

// select select

export interface SelectSqlColumn {
  readonly expr: ExprSql;
  readonly as: string;
}

// select from

export interface GenericSqlSource<TType extends string> {
  readonly type: TType;
  readonly as: string;
}

export interface QuerySqlSource extends GenericSqlSource<'query'> {
  readonly query: QuerySql;
}

export interface TableSqlSource extends GenericSqlSource<'table'> {
  readonly table: string;
}

export interface RawSqlSource extends GenericSqlSource<'sql'> {
  readonly sql: RawSql;
}

export type SqlSource = TableSqlSource | QuerySqlSource | RawSqlSource;

// select join

export interface SelectSqlJoin {
  readonly right: SqlSource;
  readonly condition: ExprSql;
  readonly type: JoinType;
  readonly lateral: boolean;
}

// order by

export interface SqlOrderBy {
  readonly type: OrderByType;
  readonly expr: ExprSql;
}

// === combination ===

export type SqlCombinationType = 'union' | 'union_all' | 'intersect' | 'except';

export interface CombinationSql extends GenericSql<'combination'> {
  readonly combType: SqlCombinationType;
  readonly lhs: QuerySql;
  readonly rhs: QuerySql;
}

// literals

export const nullLiteral: LiteralSql = {
  type: 'literal',
  parameter: false,
  literal: {
    type: {type: 'null', nullable: true},
    value: null,
  },
};

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
    type: {type: 'string', nullable: false},
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
