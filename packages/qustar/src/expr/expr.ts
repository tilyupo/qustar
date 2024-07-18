import {match} from 'ts-pattern';
import {
  Literal,
  LiteralValue,
  ScalarType,
  SingleLiteralValue,
  inferLiteral,
} from '../literal.js';
import {Assert, Equal} from '../types.js';
import {arrayEqual, assert, assertNever} from '../utils.js';
import {Projection, PropPath, ScalarProjection} from './projection.js';
import {Query, QuerySource} from './query.js';

// expr

export type ScalarOperand<T extends SingleLiteralValue> = T | Expr<T>;

export interface CaseWhenPublic<T extends SingleLiteralValue> {
  readonly condition: ScalarOperand<any>;
  readonly result: ScalarOperand<T>;
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
    operand: ScalarOperand<T> | InferArray<T>
  ): Expr<T> {
    if (operand instanceof Expr) {
      return operand;
    }

    return new LiteralExpr<T>(inferLiteral(operand));
  }

  // sql

  static sql<T extends SingleLiteralValue>(
    src: string,
    ...args: LiteralValue[]
  ): Expr<T> {
    return new SqlExpr<T>(src, args);
  }

  // unary

  static bitwiseNot<T extends Nullable<number>>(
    operand: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).bitwiseNot();
  }
  static not<T extends Nullable<boolean>>(operand: ScalarOperand<T>): Expr<T> {
    return Expr.from(operand).not();
  }
  static minus<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T>;
  static minus<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T>;
  static minus<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs?: ScalarOperand<T>
  ): Expr<T> {
    if (rhs !== undefined) {
      return Expr.from(lhs).minus(rhs);
    } else {
      return Expr.from(lhs).minus();
    }
  }
  static plus<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T>;
  static plus<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T>;
  static plus<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs?: ScalarOperand<T>
  ): Expr<T> {
    if (rhs !== undefined) {
      return Expr.from(lhs).plus(rhs);
    } else {
      return Expr.from(lhs).plus();
    }
  }

  // binary

  static add<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).add(rhs);
  }
  static sub<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).sub(rhs);
  }
  static subtract<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).subtract(rhs);
  }
  static mul<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).mul(rhs);
  }
  static multiply<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).multiply(rhs);
  }
  static div<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).div(rhs);
  }
  static divide<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).divide(rhs);
  }
  static mod<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).mod(rhs);
  }
  static modulus<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).modulus(rhs);
  }
  static shl<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).shl(rhs);
  }
  static shiftLeft<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).shiftLeft(rhs);
  }
  static shr<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).shr(rhs);
  }
  static shiftRight<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).shiftRight(rhs);
  }
  static bitwiseAnd<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).bitwiseAnd(rhs);
  }
  static bitwiseXor<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).bitwiseXor(rhs);
  }
  static bitwiseOr<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).bitwiseOr(rhs);
  }
  static or<T extends Nullable<boolean>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).or(rhs);
  }
  static and<T extends Nullable<boolean>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(lhs).and(rhs);
  }
  static gt<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).gt(rhs);
  }
  static greaterThan<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).greaterThan(rhs);
  }
  static ge<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).ge(rhs);
  }
  static gte<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).gte(rhs);
  }
  static greaterThanOrEqualTo<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).greaterThanOrEqualTo(rhs);
  }
  static lt<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lt(rhs);
  }
  static lessThan<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lessThan(rhs);
  }
  static le<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).le(rhs);
  }
  static lte<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lte(rhs);
  }
  static lessThanOrEqualTo<T extends Nullable<number>>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).lessThanOrEqualTo(rhs);
  }
  static eq<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).eq(rhs);
  }
  static equals<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).equals(rhs);
  }
  static ne<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).ne(rhs);
  }
  static notEquals<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    rhs: ScalarOperand<T>
  ): Expr<boolean> {
    return Expr.from(lhs).notEquals(rhs);
  }
  static like<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    pattern: ScalarOperand<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).like(pattern);
  }
  static in<T extends SingleLiteralValue>(
    lhs: ScalarOperand<T>,
    rhs: InferArray<T> | Query<T>
  ): Expr<NullPropagate<T, boolean>> {
    return Expr.from(lhs).in(rhs);
  }

  // case

  static ternary<T extends SingleLiteralValue>(
    condition: ScalarOperand<boolean>,
    consequent: ScalarOperand<T>,
    alternate: ScalarOperand<T>
  ): Expr<T> {
    return new CaseExpr<T>(
      Expr.from(condition),
      [
        {
          condition: Expr.from(true),
          result: Expr.from(consequent),
        },
        {
          condition: Expr.from(false),
          result: Expr.from(alternate),
        },
      ],
      // safety: condition is true or false, fallback is never used
      Expr.from(null) as unknown as Expr<T>
    );
  }

  static case<T extends SingleLiteralValue>(
    subject: ScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[]
  ): Expr<T | null>;
  static case<T extends SingleLiteralValue>(
    subject: ScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback: ScalarOperand<T>
  ): Expr<T>;
  static case<T extends SingleLiteralValue>(
    subject: ScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback?: ScalarOperand<T> | undefined
  ): Expr<T | null>;
  static case<T extends SingleLiteralValue>(
    subject: ScalarOperand<any>,
    whens: readonly CaseWhenPublic<T>[],
    fallback?: ScalarOperand<T> | undefined
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
    lhs: ScalarOperand<T>,
    indexStart: ScalarOperand<Index>,
    indexEnd?: ScalarOperand<Index>
  ): Expr<NullPropagate<Index, T>> {
    return Expr.from(lhs).substring(indexStart, indexEnd);
  }

  static toString<T extends Nullable<SingleLiteralValue>>(
    lhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, string>> {
    return Expr.from(lhs).toString();
  }

  static toFloat<T extends Nullable<SingleLiteralValue>>(
    lhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, number>> {
    return Expr.from(lhs).toFloat();
  }

  static toInt<T extends Nullable<SingleLiteralValue>>(
    lhs: ScalarOperand<T>
  ): Expr<NullPropagate<T, number>> {
    return Expr.from(lhs).toInt();
  }

  static concat<T extends Nullable<string>>(
    first: ScalarOperand<T>,
    ...operands: ScalarOperand<T>[]
  ): Expr<T> {
    return Expr.from(first).concat(...operands);
  }

  static count<T extends Nullable<number>>(
    operand: ScalarOperand<T>
  ): Expr<number> {
    return Expr.from(operand).count();
  }

  static avg<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T> {
    return Expr.from(operand).avg();
  }

  static average<T extends Nullable<number>>(
    operand: ScalarOperand<T>
  ): Expr<T> {
    return Expr.from(operand).average();
  }

  static sum<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T> {
    return Expr.from(operand).sum();
  }

  static min<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T> {
    return Expr.from(operand).min();
  }

  static max<T extends Nullable<number>>(operand: ScalarOperand<T>): Expr<T> {
    return Expr.from(operand).max();
  }

  // visitor

  abstract visit<V>(visitor: ExprVisitor<V>): V;

  // projection

  abstract projection(): Projection;

  // unary

  // T extends boolean | null
  not(): Expr<T> {
    return new UnaryExpr<T>('!', this);
  }
  bitwiseNot(): Expr<T> {
    return new UnaryExpr<T>('~', this);
  }
  minus(): Expr<T>;
  minus(rhs: ScalarOperand<T>): Expr<T>;
  minus(rhs?: ScalarOperand<T>): Expr<T> {
    if (rhs !== undefined) {
      return new BinaryExpr<T>('-', this, Expr.from(rhs));
    } else {
      return new UnaryExpr<T>('-', this);
    }
  }
  plus(): Expr<T>;
  plus(rhs: ScalarOperand<T>): Expr<T>;
  plus(rhs?: ScalarOperand<T>): Expr<T> {
    if (rhs !== undefined) {
      return new BinaryExpr<T>('+', this, Expr.from(rhs));
    } else {
      return new UnaryExpr<T>('+', this);
    }
  }

  // binary

  add<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('+', this, Expr.from(rhs));
  }
  sub<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('-', this, Expr.from(rhs));
  }
  subtract<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.sub(rhs);
  }
  mul<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('*', this, Expr.from(rhs));
  }
  multiply<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.mul(rhs);
  }
  mod<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('%', this, Expr.from(rhs));
  }
  modulus<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.mod(rhs);
  }
  div<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('/', this, Expr.from(rhs));
  }
  divide<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.div(rhs);
  }
  shl<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('<<', this, Expr.from(rhs));
  }
  shiftLeft<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.shl(rhs);
  }
  shr<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('>>', this, Expr.from(rhs));
  }
  shiftRight<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return this.shr(rhs);
  }
  bitwiseAnd<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('&', this, Expr.from(rhs));
  }
  bitwiseXor<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('^', this, Expr.from(rhs));
  }
  bitwiseOr<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('|', this, Expr.from(rhs));
  }
  or<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('or', this, Expr.from(rhs));
  }
  and<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<NullPropagate<R, T>> {
    return new BinaryExpr<NullPropagate<R, T>>('and', this, Expr.from(rhs));
  }
  gt<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('>', this, Expr.from(rhs));
  }
  greaterThan<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.gt(rhs);
  }
  ge<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('>=', this, Expr.from(rhs));
  }
  gte<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.ge(rhs);
  }
  greaterThanOrEqualTo<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<boolean> {
    return this.ge(rhs);
  }
  lt<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('<', this, Expr.from(rhs));
  }
  lessThan<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.lt(rhs);
  }
  le<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('<=', this, Expr.from(rhs));
  }
  lte<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.le(rhs);
  }
  lessThanOrEqualTo<R extends Nullable<T>>(
    rhs: ScalarOperand<R>
  ): Expr<boolean> {
    return this.le(rhs);
  }
  eq<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr('==', this, Expr.from(rhs));
  }
  equals<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.eq(rhs);
  }
  ne<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr('!=', this, Expr.from(rhs));
  }
  notEquals<R extends Nullable<T>>(rhs: ScalarOperand<R>): Expr<boolean> {
    return this.ne(rhs);
  }
  like<R extends Nullable<T>>(pattern: ScalarOperand<R>): Expr<boolean> {
    return new BinaryExpr<boolean>('like', this, Expr.from(pattern));
  }
  in<R extends Nullable<T>>(rhs: InferArray<R> | Query<R>): Expr<boolean> {
    if (rhs instanceof Query) {
      return rhs.contains(this as Expr<R>) as Expr<boolean>;
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
    fallback: ScalarOperand<R>
  ): Expr<R>;
  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[],
    fallback: ScalarOperand<R> | undefined
  ): Expr<Nullable<R>>;
  case<R extends SingleLiteralValue>(
    whens: readonly CaseWhenPublic<R>[],
    fallback?: ScalarOperand<R>
  ): Expr<R> {
    return Expr.case(this, whens, fallback);
  }

  // func

  substring<TIndex extends Nullable<number>>(
    indexStart: ScalarOperand<TIndex>,
    indexEnd?: ScalarOperand<TIndex>
  ): Expr<NullPropagate<TIndex, T>> {
    return new FuncExpr<NullPropagate<TIndex, T>>('substring', [
      this,
      Expr.from(indexStart),
      ...(indexEnd === undefined ? [] : [Expr.from(indexEnd)]),
    ]);
  }

  toString(): Expr<NullPropagate<T, string>> {
    return new FuncExpr<NullPropagate<T, string>>('to_string', [this]);
  }

  toFloat(): Expr<NullPropagate<T, number>> {
    return new FuncExpr<NullPropagate<T, number>>('to_float', [this]);
  }

  toInt(): Expr<NullPropagate<T, number>> {
    return new FuncExpr<NullPropagate<T, number>>('to_int', [this]);
  }

  concat<R extends Nullable<string>>(
    ...operands: ScalarOperand<R>[]
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

  avg(): Expr<Nullable<T>> {
    return new FuncExpr('avg', [this]);
  }

  average(): Expr<Nullable<T>> {
    return this.avg();
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
  | 'substring'
  | 'concat'
  | 'to_string'
  | 'to_float'
  | 'to_int'
  | 'avg'
  | 'count'
  | 'sum'
  | 'max'
  | 'min';

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

  projection(): Projection {
    const argProjections = this.args.map(x => x.projection());
    assert(
      argProjections.every(x => x.type === 'scalar'),
      'invalid func args, scalars required'
    );
    const nullable = argProjections.some(
      x => x.type !== 'scalar' || x.scalarType.nullable
    );
    if (this.func === 'substring') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'varchar',
          nullable,
        },
        expr: this,
      };
    } else if (this.func === 'concat') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'varchar',
          nullable,
        },
        expr: this,
      };
    } else if (this.func === 'to_string') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'varchar',
          nullable,
        },
        expr: this,
      };
    } else if (this.func === 'to_float') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'f32',
          nullable,
        },
        expr: this,
      };
    } else if (this.func === 'to_int') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'i32',
          nullable,
        },
        expr: this,
      };
    } else if (this.func === 'count') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'i64',
          nullable: false,
        },
        expr: this,
      };
    } else if (
      this.func === 'avg' ||
      this.func === 'max' ||
      this.func === 'min' ||
      this.func === 'sum'
    ) {
      const firstArgProj = argProjections[0];
      assert(firstArgProj.type === 'scalar', 'checked above that scalar');
      return {
        type: 'scalar',
        scalarType: firstArgProj.scalarType,
        expr: this,
      };
    }

    return assertNever(this.func, 'invalid func: ' + this.func);
  }
}

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
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
    const left = this.lhs.projection();
    const right = this.rhs.projection();

    // for those we want to handle nulls differently
    // we will translate == to is+== pair for nullable
    if (this.op === '!=' || this.op === '==') {
      return {
        type: 'scalar',
        expr: this,
        scalarType: {
          type: 'boolean',
          nullable: false,
        },
      };
    } else if (binaryOpIsLogical(this.op)) {
      assert(
        left.type === 'scalar' && right.type === 'scalar',
        'logical operations are supported only for scalars'
      );

      if (this.op === 'in') {
        assert(
          right.scalarType.type === 'array',
          'in can only operate in array to the right of it'
        );
      }

      return {
        type: 'scalar',
        expr: this,
        scalarType: {
          type: 'boolean',
          nullable: left.scalarType.nullable || right.scalarType.nullable,
        },
      };
    } else if (
      this.op === '&' ||
      this.op === '|' ||
      this.op === '^' ||
      this.op === '<<' ||
      this.op === '>>'
    ) {
      assert(
        left.type === 'scalar' && right.type === 'scalar',
        'bit operations are supported only for integers'
      );
      assertInt(left.scalarType);
      assertInt(right.scalarType);

      return {
        type: 'scalar',
        expr: this,
        scalarType: {
          type: 'i64',
          nullable: left.scalarType.nullable || right.scalarType.nullable,
        },
      };
    } else if (this.op === '+') {
      assert(
        left.type === 'scalar' && right.type === 'scalar',
        'bit operations are supported only for numbers'
      );
      assertNumericOrChar(left.scalarType);
      assertNumericOrChar(right.scalarType);

      return {
        type: 'scalar',
        expr: this,
        scalarType: {
          // todo: handle promotion gracefully
          type:
            isChar(left.scalarType) || isChar(right.scalarType)
              ? 'varchar'
              : 'f64',
          nullable: left.scalarType.nullable || right.scalarType.nullable,
        },
      };
    } else if (
      this.op === '-' ||
      this.op === '*' ||
      this.op === '/' ||
      this.op === '%'
    ) {
      assert(
        left.type === 'scalar' && right.type === 'scalar',
        'bit operations are supported only for numbers'
      );
      assertNumeric(left.scalarType);

      return {
        type: 'scalar',
        expr: this,
        scalarType: {
          // todo: handle promotion gracefully
          type: 'f64',
          nullable: left.scalarType.nullable || right.scalarType.nullable,
        },
      };
    }

    return assertNever(this.op, 'invalid op: ' + this.op);
  }
}

export type UnaryOp = '!' | '-' | '+' | '~';

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
    const innerProj = this.inner.projection();

    if (innerProj.type === 'object') {
      throw new Error('unary operation can only be applied to scalars');
    } else if (innerProj.type === 'scalar') {
      if (this.op === '!') {
        return {
          type: 'scalar',
          expr: this,
          scalarType: {
            type: 'boolean',
            nullable: false,
          },
        };
      } else {
        return {...innerProj, expr: this};
      }
    }

    return assertNever(innerProj, 'invalid inner projection: ' + innerProj);
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
    // todo: same as with binary, we should handle type conversion/promotion
    // we probably should also assert that types are compatible

    // asserted in ctor that at least one when is present, so safe
    const innerProj = this.whens[0].result.projection();

    if (innerProj.type === 'object') {
      throw new Error('case expression can only operate on scalars');
    } else if (innerProj.type === 'scalar') {
      return {...innerProj, expr: this};
    }

    return assertNever(innerProj, 'invalid inner projection: ' + innerProj);
  }
}

export class LocatorExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly root: QuerySource,
    public readonly path: readonly PropPath[],
    private readonly nullable: boolean
  ) {
    super();
  }

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.locator(this);
  }

  push(...parts: PropPath[]): LocatorExpr<any> {
    return new LocatorExpr(this.root, [...this.path, ...parts], this.nullable);
  }

  truncate(end: number): LocatorExpr<any> {
    return new LocatorExpr(this.root, this.path.slice(0, end), this.nullable);
  }

  pop(): LocatorExpr<any> {
    return this.truncate(this.path.length - 1);
  }

  projection(): Projection {
    let proj: Projection = match(this.root.projection)
      .with({type: 'object'}, x => ({
        ...x,
        nullable: x.nullable || this.nullable,
      }))
      .with({type: 'scalar'}, x => ({
        ...x,
        scalarType: {
          ...x.scalarType,
          nullable: x.scalarType.nullable || this.nullable,
        },
      }))
      .exhaustive();

    let currentPath: readonly PropPath[] = [];
    for (const part of this.path) {
      currentPath = [...currentPath, part];

      if (proj.type === 'scalar') {
        throw new Error('cannot use path on scalar: ' + proj.type);
      } else if (proj.type === 'object') {
        const ref = proj.refs.find(x => arrayEqual(x.path, part));
        if (ref) {
          proj = match(ref?.parent().projection)
            .with(
              {type: 'scalar'},
              (x): Projection => ({
                ...x,
                scalarType: {
                  ...x.scalarType,
                  nullable: x.scalarType.nullable || ref.nullable,
                },
              })
            )
            .with(
              {type: 'object'},
              (x): Projection => ({
                ...x,
                nullable: x.nullable || ref.nullable,
              })
            )
            .exhaustive();
        } else {
          const prop = proj.props.find(
            x => x.type === 'wildcard' || arrayEqual(x.path, part)
          );
          if (prop) {
            if (prop.type === 'single') {
              proj = {
                type: 'scalar',
                scalarType: {
                  ...prop.scalarType,
                  nullable: proj.nullable || prop.scalarType.nullable,
                },
                expr: prop.expr,
              };
            } else if (prop.type === 'wildcard') {
              proj = {
                type: 'scalar',
                scalarType: {
                  type: 'dynamic',
                  nullable: true,
                },
                expr: new LocatorExpr(
                  this.root,
                  [...currentPath],
                  this.nullable
                ),
              };
            } else {
              assertNever(prop, 'invalid prop: ' + prop);
            }
          } else {
            throw new Error('invalid projection prop: ' + part);
          }
        }
      } else {
        assertNever(proj, 'invalid projection: ' + proj);
      }
    }

    return match(proj)
      .with({type: 'object'}, x => x)
      .with(
        {type: 'scalar'},
        (x): ScalarProjection => ({
          type: 'scalar',
          expr: this,
          scalarType: x.scalarType,
        })
      )
      .exhaustive();
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
    return {type: 'scalar', scalarType: this.literal.type, expr: this};
  }
}

export class SqlExpr<T extends SingleLiteralValue> extends Expr<T> {
  constructor(
    public readonly src: string,
    public readonly args: LiteralValue[] = []
  ) {
    super();
  }

  visit<V>(visitor: ExprVisitor<V>): V {
    return visitor.sql(this);
  }

  projection(): Projection {
    return {
      type: 'scalar',
      expr: this,
      scalarType: {type: 'dynamic', nullable: true},
    };
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

  visit<T>(visitor: ExprVisitor<T>): T {
    return visitor.queryTerminator(this);
  }

  projection(): Projection {
    if (this.terminator === 'max' || this.terminator === 'min') {
      const queryProj = this.query.projection;
      assert(
        queryProj.type === 'scalar',
        'query projection is not scalar: ' + queryProj.type
      );
      return {
        type: 'scalar',
        scalarType: {
          ...queryProj.scalarType,
          nullable: true,
        },
        expr: this,
      };
    } else if (this.terminator === 'sum' || this.terminator === 'mean') {
      const queryProj = this.query.projection;
      assert(
        queryProj.type === 'scalar',
        'query projection is not scalar: ' + queryProj.type
      );
      assertNumeric(queryProj.scalarType);
      return {
        type: 'scalar',
        scalarType: {
          ...queryProj.scalarType,
          nullable: true,
        },
        expr: this,
      };
    } else if (this.terminator === 'empty' || this.terminator === 'some') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'boolean',
          nullable: false,
        },
        expr: this,
      };
    } else if (this.terminator === 'size') {
      return {
        type: 'scalar',
        scalarType: {
          type: 'i64',
          nullable: false,
        },
        expr: this,
      };
    } else if (this.terminator === 'first') {
      return this.query.projection;
    }

    return assertNever(
      this.terminator,
      'invalid terminator: ' + this.terminator
    );
  }
}

export function assertNumericOrChar(type: ScalarType): void {
  assert(
    isNumeric(type) || isChar(type),
    'type is not numeric nor char: ' + type.type
  );
}

export function assertNumeric(type: ScalarType): void {
  assert(isNumeric(type), 'type is not numeric: ' + type.type);
}

export function isFloat(type: ScalarType): boolean {
  return (
    type.type === 'f64' ||
    type.type === 'f32' ||
    type.type === 'dynamic' ||
    type.type === 'null'
  );
}

export function isNumeric(type: ScalarType): boolean {
  return (
    isFloat(type) ||
    isInt(type) ||
    type.type === 'dynamic' ||
    type.type === 'null'
  );
}

export function isChar(type: ScalarType): boolean {
  return (
    type.type === 'varchar' ||
    type.type === 'char' ||
    type.type === 'dynamic' ||
    type.type === 'null'
  );
}

export function isInt(type: ScalarType): boolean {
  return (
    type.type === 'i8' ||
    type.type === 'i16' ||
    type.type === 'i32' ||
    type.type === 'i64' ||
    type.type === 'u8' ||
    type.type === 'u16' ||
    type.type === 'u32' ||
    type.type === 'u64' ||
    type.type === 'dynamic' ||
    type.type === 'null'
  );
}

export function assertInt(type: ScalarType): void {
  assert(isInt(type), 'type is not integer: ' + type.type);
}
