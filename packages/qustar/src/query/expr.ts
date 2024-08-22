import {match} from 'ts-pattern';
import {Connector, materialize, SqlCommand} from '../connector.js';
import {
  DeriveEntityPropertyValue,
  ScalarDescriptor,
  scalarDescriptorToScalarType,
} from '../descriptor.js';
import {
  inferLiteral,
  Literal,
  ScalarType,
  SingleLiteralValue,
  StringScalarType,
} from '../literal.js';
import {renderMysql} from '../render/mysql.js';
import {renderPostgresql} from '../render/postgresql.js';
import {renderSqlite} from '../render/sqlite.js';
import {optimize} from '../sql/optimizer.js';
import {Assert, Equal} from '../types/query.js';
import {assert, assertNever} from '../utils.js';
import {compileQuery} from './compiler.js';
import {ExprProjection, Projection} from './projection.js';
import {Dialect, Query, QuerySource, RenderOptions} from './query.js';
import {SqlTemplate} from './schema.js';
import {ObjectShape, QueryShape, ScalarShape, Shape} from './shape.js';

// expr

export type SingleScalarOperand<
  T extends SingleLiteralValue = SingleLiteralValue,
> = T | Expr<T>;

export interface CaseWhenPublic<T extends SingleLiteralValue> {
  readonly condition: SingleScalarOperand<any>;
  readonly result: SingleScalarOperand<T>;
}

export type NullPropagate<T extends SingleLiteralValue, TResult> = [
  null,
] extends [T]
  ? null | TResult
  : TResult;
export type __TestNullPropagate = Assert<
  [
    Equal<NullPropagate<number, number>, number>,
    Equal<NullPropagate<number | null, number>, number | null>,
  ]
>;

export type Nullable<T> = T | null;

export interface ExprVisitor<T> {
  binary(expr: BinaryExpr<any>): T;
  unary(expr: UnaryExpr<any>): T;
  literal(expr: LiteralExpr<any>): T;
  case(expr: CaseExpr<any>): T;
  queryTerminator(expr: QueryTerminatorExpr<any>): T;
  func(expr: FuncExpr<any>): T;
  locator(expr: LocatorExpr<any>): T;
  sql(expr: SqlExpr<any>): T;
}

// todo: handle nullable
type InferArray<T> = T extends any ? T[] : never;

export abstract class Expr<T extends SingleLiteralValue> {
  static from<T extends SingleLiteralValue>(
    operand: SingleScalarOperand<T> | InferArray<T>
  ): Expr<T> {
    if (operand instanceof Expr) {
      return operand;
    }

    return new LiteralExpr<T>(inferLiteral(operand));
  }

  // sql

  static rawExpr<const TSchema extends ScalarDescriptor>(options: {
    sql: SqlTemplate | string;
    schema: TSchema;
  }): Expr<DeriveEntityPropertyValue<TSchema>> {
    return new SqlExpr<DeriveEntityPropertyValue<TSchema>>(
      SqlTemplate.derive(options.sql),
      scalarDescriptorToScalarType(options.schema)
    );
  }

  // unary

  static not<T extends Nullable<boolean>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).not();
  }
  static negate<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).negate();
  }

  // binary

  static add<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).add(rhs);
  }
  static sub<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).sub(rhs);
  }
  static mul<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).mul(rhs);
  }
  static div<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).div(rhs);
  }
  static mod<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).mod(rhs);
  }
  static or<T extends Nullable<boolean>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).or(rhs);
  }
  static and<T extends Nullable<boolean>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).and(rhs);
  }
  static gt<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).gt(rhs);
  }
  static gte<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).gte(rhs);
  }
  static lt<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lt(rhs);
  }
  static lte<T extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lte(rhs);
  }
  static eq<T extends SingleLiteralValue>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).eq(rhs);
  }
  static ne<T extends SingleLiteralValue>(
    lhs: SingleScalarOperand<T>,
    rhs: SingleScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).ne(rhs);
  }
  static like<T extends SingleLiteralValue>(
    lhs: SingleScalarOperand<T>,
    pattern: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).like(pattern);
  }
  static in<T extends SingleLiteralValue>(
    lhs: SingleScalarOperand<T>,
    rhs: InferArray<T> | Query<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).in(rhs);
  }

  // case

  static case<T extends SingleLiteralValue>(
    subject: SingleScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[]
  ): Expr<T | null>;
  static case<T extends SingleLiteralValue>(
    subject: SingleScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback: SingleScalarOperand<T>
  ): Expr<T>;
  static case<T extends SingleLiteralValue>(
    subject: SingleScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback?: SingleScalarOperand<T> | undefined
  ): Expr<T | null>;
  static case<T extends SingleLiteralValue>(
    subject: SingleScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback?: SingleScalarOperand<T> | undefined
  ): Expr<T> {
    return new CaseExpr<T>(
      Expr.from(subject),
      whens.map(x => ({
        condition: Expr.from(x.condition),
        result: Expr.from(x.result),
      })),
      Expr.from<any>(fallback ?? null)
    );
  }

  // func

  static substring<T extends Nullable<string>, Index extends Nullable<number>>(
    lhs: SingleScalarOperand<T>,
    indexStart: SingleScalarOperand<Index>,
    indexEnd?: SingleScalarOperand<Index>
  ): Expr<NullPropagate<Index, T>> {
    return Expr.from(lhs).substring(indexStart, indexEnd);
  }

  static toLowerCase<
    T extends Nullable<string>,
    Index extends Nullable<number>,
  >(lhs: SingleScalarOperand<T>): Expr<NullPropagate<Index, T>> {
    return Expr.from(lhs).toLowerCase();
  }

  static toUpperCase<
    T extends Nullable<string>,
    Index extends Nullable<number>,
  >(lhs: SingleScalarOperand<T>): Expr<NullPropagate<Index, T>> {
    return Expr.from(lhs).toUpperCase();
  }

  static length_<T extends Nullable<string>, Index extends Nullable<number>>(
    lhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<Index, T>> {
    return Expr.from(lhs).length();
  }

  static toString<T extends Nullable<SingleLiteralValue>>(
    lhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, string>> {
    return Expr.from(lhs).toString();
  }

  static toFloat<T extends Nullable<SingleLiteralValue>>(
    lhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, number>> {
    return Expr.from(lhs).toFloat();
  }

  static toInt<T extends Nullable<SingleLiteralValue>>(
    lhs: SingleScalarOperand<T>
  ): Expr<NullPropagate<T, number>> {
    return Expr.from(lhs).toInt();
  }

  static concat<T extends Nullable<string>>(
    first: SingleScalarOperand<T>,
    ...operands: SingleScalarOperand<T>[]
  ): Expr<T> {
    return Expr.from(first).concat(...operands);
  }

  static count<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<number> {
    return Expr.from(operand).count();
  }

  static average<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).average();
  }

  static sum<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).sum();
  }

  static min<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).min();
  }

  static max<T extends Nullable<number>>(
    operand: SingleScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).max();
  }

  // visitor

  abstract visit<V>(visitor: ExprVisitor<V>): V;

  // projection

  abstract projection(): Projection;

  // shape

  abstract shape(): Shape;

  // unary

  // T extends boolean | null
  not(): Expr<T> {
    return new UnaryExpr<T>('!', this);
  }
  negate(): Expr<T> {
    return new UnaryExpr<T>('-', this);
  }

  // binary

  add<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('+', this, Expr.from(rhs));
  }
  sub<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('-', this, Expr.from(rhs));
  }
  mul<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('*', this, Expr.from(rhs));
  }
  mod<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('%', this, Expr.from(rhs));
  }
  div<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('/', this, Expr.from(rhs));
  }
  or<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('or', this, Expr.from(rhs));
  }
  and<R extends Nullable<T>>(
    rhs: SingleScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('and', this, Expr.from(rhs));
  }
  gt<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('>', this, Expr.from(rhs));
  }
  gte<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('>=', this, Expr.from(rhs));
  }
  lt<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('<', this, Expr.from(rhs));
  }
  lte<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('<=', this, Expr.from(rhs));
  }
  eq<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr('==', this, Expr.from(rhs));
  }
  ne<R extends Nullable<T>>(rhs: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr('!=', this, Expr.from(rhs));
  }
  like<R extends Nullable<T>>(pattern: SingleScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('like', this, Expr.from(pattern));
  }
  in<R extends Nullable<T>>(rhs: InferArray<R> | Query<R>): Expr<boolean> {
    if (rhs instanceof Query) {
      return rhs.includes(this as Expr<R>) as Expr<boolean>;
    } else {
      return new BinaryExpr<boolean>('in', this, Expr.from(rhs));
    }
  }

  // case

  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[]
  ): Expr<Nullable<R>>;
  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[],
    fallback: SingleScalarOperand<R>
  ): Expr<R>;
  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[],
    fallback: SingleScalarOperand<R> | undefined
  ): Expr<Nullable<R>>;
  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[],
    fallback?: SingleScalarOperand<R>
  ): Expr<R> {
    return Expr.case(this, whens, fallback);
  }

  // func

  substring<TIndex extends Nullable<number>>(
    indexStart: SingleScalarOperand<TIndex>,
    indexEnd?: SingleScalarOperand<TIndex>
  ): Expr<NullPropagate<TIndex, T>> {
    return new FuncExpr<NullPropagate<TIndex, T>>('substring', [
      this,
      Expr.from(indexStart),
      ...(indexEnd === undefined ? [] : [Expr.from(indexEnd)]),
    ]);
  }

  toLowerCase<TIndex extends Nullable<number>>(): Expr<
    NullPropagate<TIndex, T>
  > {
    return new FuncExpr<NullPropagate<TIndex, T>>('lower', [this]);
  }

  toUpperCase<TIndex extends Nullable<number>>(): Expr<
    NullPropagate<TIndex, T>
  > {
    return new FuncExpr<NullPropagate<TIndex, T>>('upper', [this]);
  }

  length<TIndex extends Nullable<number>>(): Expr<NullPropagate<TIndex, T>> {
    return new FuncExpr<NullPropagate<TIndex, T>>('length', [this]);
  }

  toString(): Expr<NullPropagate<T, string>> {
    return new FuncExpr<NullPropagate<T, string>>('to_string', [this]);
  }

  toFloat(): Expr<NullPropagate<T, number>> {
    return new FuncExpr<NullPropagate<T, number>>('to_float32', [this]);
  }

  toInt(): Expr<NullPropagate<T, number>> {
    return new FuncExpr<NullPropagate<T, number>>('to_int32', [this]);
  }

  concat<R extends Nullable<string>>(
    ...operands: SingleScalarOperand<R>[]
  ): Expr<NullPropagate<R, T>> {
    if (operands.length === 0) {
      return this;
    }

    return new FuncExpr<NullPropagate<R, T>>('concat', [
      this,
      ...operands.map(Expr.from),
    ]);
  }

  count(): Expr<number> {
    return new FuncExpr('count', [this]);
  }

  average(): Expr<Nullable<T>> {
    return new FuncExpr('avg', [this]);
  }

  sum(): Expr<Nullable<T>> {
    return new FuncExpr('sum', [this]);
  }

  min(): Expr<Nullable<T>> {
    return new FuncExpr('min', [this]);
  }

  max(): Expr<Nullable<T>> {
    return new FuncExpr('max', [this]);
  }
}

export type Func =
  | 'lower'
  | 'upper'
  | 'substring'
  | 'concat'
  | 'to_string'
  | 'to_float32'
  | 'to_int32'
  | 'avg'
  | 'count'
  | 'sum'
  | 'max'
  | 'min'
  | 'length';

export class FuncExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly func: Func,
    public readonly args: ReadonlyArray<Expr<any>>
  ) {
    super();
  }

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.func(this);
  }

  shape(): Shape {
    const argShapes = this.args.map(x => x.shape());
    assert(
      argShapes.every(x => x instanceof ScalarShape),
      'invalid func args, scalars required'
    );
    const nullable = argShapes.some(
      // safety: checked above that all args are of ScalarProjection type
      x => (x as ScalarShape).type.nullable
    );
    if (
      this.func === 'substring' ||
      this.func === 'lower' ||
      this.func === 'upper'
    ) {
      return new ScalarShape({
        type: 'string',
        nullable,
      });
    } else if (this.func === 'concat') {
      return new ScalarShape({
        type: 'string',
        nullable,
      });
    } else if (this.func === 'to_string') {
      return new ScalarShape({
        type: 'string',
        nullable,
      });
    } else if (this.func === 'to_float32') {
      return new ScalarShape({
        type: 'f32',
        nullable,
      });
    } else if (this.func === 'to_int32') {
      return new ScalarShape({
        type: 'i32',
        nullable,
      });
    } else if (this.func === 'count') {
      return new ScalarShape({
        type: 'i64',
        nullable: false,
      });
    } else if (
      this.func === 'avg' ||
      this.func === 'max' ||
      this.func === 'min' ||
      this.func === 'sum'
    ) {
      const firstArgProj = argShapes[0];
      assert(firstArgProj instanceof ScalarShape, 'checked above that scalar');
      assert(
        firstArgProj.type.type !== 'array',
        'can not use array for aggregation'
      );
      return new ScalarShape({
        type: firstArgProj.type.type,
        nullable: true,
      });
    } else if (this.func === 'length') {
      const firstArgProj = argShapes[0];
      assert(firstArgProj instanceof ScalarShape, 'checked above that scalar');
      assertString(firstArgProj.type);
      return new ScalarShape({type: 'i32', nullable});
    }

    return assertNever(this.func, 'invalid func: ' + this.func);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }
}

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | 'or'
  | 'and'
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | '!='
  | 'like'
  | 'in'
  | '%';

export function binaryOpIsLogical(
  op: BinaryOp
): op is '<=' | '>=' | '<' | '>' | 'and' | 'or' | 'like' | 'in' | '==' | '!=' {
  return (
    op === '!=' ||
    op === '==' ||
    op === '<=' ||
    op === '>=' ||
    op === '<' ||
    op === '>' ||
    op === 'and' ||
    op === 'or' ||
    op === 'like' ||
    op === 'in'
  );
}

export class BinaryExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly op: BinaryOp,
    public readonly lhs: Expr<any>,
    public readonly rhs: Expr<any>
  ) {
    super();
  }

  visit<V>(visitor: ExprVisitor<V>): V {
    return visitor.binary(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    const left = this.lhs.shape();
    const right = this.rhs.shape();

    // for those we want to handle nulls differently
    // we will translate == to is+== pair for nullable
    if (this.op === '!=' || this.op === '==') {
      return new ScalarShape({
        type: 'boolean',
        nullable: false,
      });
    } else if (binaryOpIsLogical(this.op)) {
      assert(
        left instanceof ScalarShape && right instanceof ScalarShape,
        'logical operations are supported only for scalars'
      );

      if (this.op === 'in') {
        assert(
          right.type.type === 'array',
          'in can only operate in array to the right of it'
        );
      }

      return new ScalarShape({
        type: 'boolean',
        nullable: left.type.nullable || right.type.nullable,
      });
    } else if (this.op === '+') {
      assert(
        left instanceof ScalarShape && right instanceof ScalarShape,
        'bit operations are supported only for numbers'
      );
      assertNumericOrString(left.type);
      assertNumericOrString(right.type);

      return new ScalarShape({
        // todo: handle promotion gracefully
        type: isString(left.type) || isString(right.type) ? 'string' : 'f64',
        nullable: left.type.nullable || right.type.nullable,
      });
    } else if (
      this.op === '-' ||
      this.op === '*' ||
      this.op === '/' ||
      this.op === '%'
    ) {
      assert(
        left instanceof ScalarShape && right instanceof ScalarShape,
        'bit operations are supported only for numbers'
      );
      assertNumeric(left.type);

      return new ScalarShape({
        // todo: handle promotion gracefully
        type: 'f64',
        nullable: left.type.nullable || right.type.nullable,
      });
    }

    return assertNever(this.op, 'invalid op: ' + this.op);
  }
}

export type UnaryOp = '!' | '-' | '+';

export class UnaryExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly op: UnaryOp,
    public readonly inner: Expr<any>
  ) {
    super();
  }

  visit<V>(visitor: ExprVisitor<V>): V {
    return visitor.unary(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    if (this.op === '!') {
      return new ScalarShape({
        type: 'boolean',
        nullable: false,
      });
    } else {
      const innerShape = this.inner.shape();
      assert(
        innerShape instanceof ScalarShape,
        'unary expr can only be applied to a scalar'
      );

      return innerShape;
    }
  }
}

export interface CaseWhenPrivate<T extends SingleLiteralValue> {
  readonly condition: Expr<any>;
  readonly result: Expr<T>;
}

export class CaseExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly subject: Expr<any>,
    public readonly whens: readonly CaseWhenPrivate<T>[],
    public readonly fallback: Expr<T>
  ) {
    super();

    assert(whens.length > 0, 'at least one when is required for CaseExpr');
  }

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.case(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    // todo: same as with binary, we should handle type conversion/promotion
    // we probably should also assert that types are compatible

    // asserted in ctor that at least one when is present, so safe
    const resultShapes = this.whens
      .map(x => x.result.shape())
      .concat([this.fallback.shape()]);

    assert(
      resultShapes.every(resultShape => resultShape instanceof ScalarShape),
      'case expression can only operate on scalars'
    );

    // safety: assert above checks that all shapes in resultShapes are scalar
    const scalarShapes = resultShapes as ScalarShape[];

    return new ScalarShape({
      ...scalarShapes[0].type,
      nullable: scalarShapes.some(x => x.type.nullable),
    });
  }
}

export class LocatorExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly root: QuerySource,
    public readonly path: string[],
    private readonly nullable: boolean
  ) {
    super();
  }

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.locator(this);
  }

  push(...parts: string[]): LocatorExpr<any> {
    return new LocatorExpr(this.root, [...this.path, ...parts], this.nullable);
  }

  truncate(end: number): LocatorExpr<any> {
    return new LocatorExpr(this.root, this.path.slice(0, end), this.nullable);
  }

  pop(): LocatorExpr<any> {
    return this.truncate(this.path.length - 1);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    let currentShape = this.root.shape.valueShape.visit<Shape>({
      object: x =>
        new ObjectShape({
          ...x,
          nullable: x.nullable || this.nullable,
        }),
      scalar: x =>
        new ScalarShape({
          ...x.type,
          nullable: x.type.nullable || this.nullable,
        }),
      query: x =>
        new QueryShape({
          valueShape: x.valueShape,
          nullable: x.nullable || this.nullable,
        }),
    });

    let currentPath: readonly string[] = [];
    for (const part of this.path) {
      currentPath = [...currentPath, part];

      currentShape = currentShape.visit({
        scalar: () => {
          throw new Error('cannot use path on scalar: ' + part);
        },
        query: () => {
          throw new Error('cannot use path on query: ' + part);
        },
        object: shape => {
          const prop = shape.props.find(x => x.name === part);
          if (prop) {
            return prop.shape().visit<Shape>({
              scalar: x =>
                new ScalarShape({
                  ...x.type,
                  nullable: x.nullable || currentShape.nullable,
                }),
              object: x =>
                new ObjectShape({
                  props: x.props,
                  nullable: x.nullable || currentShape.nullable,
                }),
              query: x =>
                new QueryShape({
                  nullable: x.nullable || currentShape.nullable,
                  valueShape: x.valueShape,
                }),
            });
          } else {
            throw new Error('invalid projection prop: ' + part);
          }
        },
      });
    }

    return currentShape;
  }
}

export class LiteralExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(public readonly literal: Literal) {
    super();
  }

  visit<V>(visitor: ExprVisitor<V>): V {
    return visitor.literal(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    return new ScalarShape(this.literal.type);
  }
}

export class SqlExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    readonly sql: SqlTemplate,
    readonly scalarType: ScalarType
  ) {
    super();
  }

  visit<V>(visitor: ExprVisitor<V>): V {
    return visitor.sql(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    return new ScalarShape(this.scalarType);
  }
}

// terminators

export type QueryTerminator =
  | 'max'
  | 'min'
  | 'mean'
  | 'sum'
  | 'first'
  | 'some'
  | 'empty'
  | 'size';

export class QueryTerminatorExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public terminator: QueryTerminator,
    public query: Query<any>
  ) {
    super();
  }
  pipe(): QueryTerminatorExpr<T>;
  pipe<R>(fn1: (arg: QueryTerminatorExpr<T>) => R): R;
  pipe<A, R>(fn1: (arg: QueryTerminatorExpr<T>) => A, fn2: (arg: A) => R): R;
  pipe<A, B, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => R
  ): R;
  pipe<A, B, C, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: C) => R
  ): R;
  pipe<A, B, C, D, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => R
  ): R;
  pipe<A, B, C, D, E, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => R
  ): R;
  pipe<A, B, C, D, E, F, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => F,
    fn7: (arg: F) => R
  ): R;
  pipe<A, B, C, D, E, F, G, R>(
    fn1: (arg: QueryTerminatorExpr<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => F,
    fn7: (arg: F) => G,
    fn8: (arg: G) => R
  ): R;
  pipe(...fns: Function[]) {
    if (fns.length === 0) {
      return (input: Query<T>) => input;
    }
    if (fns.length === 1) {
      return fns[0];
    }
    return fns.reverse().reduce(
      (prevFn, nextFn) =>
        (...args: any[]) =>
          prevFn(nextFn(...args))
    )(this);
  }

  async fetch(connector: Connector): Promise<T> {
    const command = connector.render(optimize(compileQuery(this)));
    const rows = await connector.query({
      sql: command.sql,
      args: command.args,
    });

    return materialize(rows[0] ?? null, this.projection());
  }

  render(dialect: Dialect, options?: RenderOptions): SqlCommand {
    return this.pipe(
      x => compileQuery(x, {parameters: false, ...options}),
      x => ((options?.optimize ?? true) ? optimize(x) : x),
      match(dialect)
        .with('sqlite', () => renderSqlite)
        .with('postgresql', () => renderPostgresql)
        .with('mysql', () => renderMysql)
        .exhaustive()
    );
  }

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.queryTerminator(this);
  }

  projection(): Projection {
    return new ExprProjection(this);
  }

  shape(): Shape {
    if (
      this.terminator === 'sum' ||
      this.terminator === 'mean' ||
      this.terminator === 'max' ||
      this.terminator === 'min'
    ) {
      const queryValueShape = this.query.shape.valueShape;
      assert(
        queryValueShape instanceof ScalarShape,
        'query projection is not scalar: ' + queryValueShape.constructor.name
      );
      assertNumeric(queryValueShape.type);
      return new ScalarShape({
        ...queryValueShape.type,
        nullable: true,
      });
    } else if (this.terminator === 'empty' || this.terminator === 'some') {
      return new ScalarShape({
        type: 'boolean',
        nullable: false,
      });
    } else if (this.terminator === 'size') {
      return new ScalarShape({
        type: 'i64',
        nullable: false,
      });
    } else if (this.terminator === 'first') {
      const queryValueShape = this.query.shape.valueShape;
      assert(
        queryValueShape instanceof ScalarShape,
        'query projection is not scalar: ' + queryValueShape.constructor.name
      );
      return new ScalarShape(queryValueShape.type);
    }

    return assertNever(
      this.terminator,
      'invalid terminator: ' + this.terminator
    );
  }
}

export function assertNumericOrString(type: ScalarType): void {
  assert(
    isNumeric(type) || isString(type),
    'type is not numeric nor char: ' + type.type
  );
}

export function assertNumeric(type: ScalarType): void {
  assert(isNumeric(type), 'type is not numeric: ' + type.type);
}

export function isFloat(type: ScalarType): boolean {
  return type.type === 'f64' || type.type === 'f32' || type.type === 'null';
}

export function isNumeric(type: ScalarType): boolean {
  return isFloat(type) || isInt(type) || type.type === 'null';
}

export function isInt(type: ScalarType): boolean {
  return (
    type.type === 'i8' ||
    type.type === 'i16' ||
    type.type === 'i32' ||
    type.type === 'i64' ||
    type.type === 'null'
  );
}

export function isString(type: ScalarType): boolean {
  return type.type === 'string' || type.type === 'null';
}

export function assertInt(type: ScalarType): void {
  assert(isInt(type), 'type is not integer: ' + type.type);
}

export function assertString(
  type: ScalarType
): asserts type is StringScalarType {
  assert(isString(type), 'type is not string: ' + type.type);
}
