import {SingleLiteralValue} from '../literal.js';
import {Expr, SingleScalarOperand} from '../query/expr.js';
import {Query} from '../query/query.js';

export type IsAny<a> = 0 extends 1 & a ? true : false;

export type Assert<T extends true[] | true> = T;
export type Not<T extends boolean> = [T] extends [true] ? false : true;
export type Equal<T1, T2> = [T1] extends [T2]
  ? [T2] extends [T1]
    ? true
    : false
  : false;
export type NotEqual<T1, T2> = Not<Equal<T1, T2>>;
type __TestEqual = Assert<
  [
    Equal<1, 1>,
    NotEqual<number, 1>,
    NotEqual<1, number>,
    Equal<{a: string}, {a: string}>,
  ]
>;

export type Never<T> = [T] extends [never] ? true : false;
export type Ever<T> = Not<Never<T>>;
type __TestEver = Assert<[Equal<Ever<1>, true>, Equal<Ever<never>, false>]>;

export type ArrayItemType<T extends readonly any[]> = [T] extends [
  ReadonlyArray<infer I>,
]
  ? I
  : never;

export type ScalarHandle<T extends SingleLiteralValue> = Expr<T>;
type __TestScalarHandle = Assert<
  Equal<Expr<SingleLiteralValue>, ScalarHandle<SingleLiteralValue>>
>;

type ValidScalar<T> = Extract<T, SingleLiteralValue>;
type ValidNavProperty<T> = ValidEntity<T> | Array<ValidEntity<T>>;
type ValidEntity<T> = {
  [K in keyof T]: ValidScalar<T> | ValidNavProperty<T[K]>;
};

export type EntityHandle<T extends object | null> = {
  [K in keyof Exclude<T, null>]: EntityPropertyHandle<
    Exclude<T, null>[K] | Extract<T, null>
  >;
};
export type EntityPropertyHandle<
  T,
  TValue = Exclude<T, null>,
  TNull extends null = Extract<T, null>,
> = [TValue] extends [SingleLiteralValue]
  ? ScalarHandle<TValue | TNull>
  : [TValue] extends [ReadonlyArray<any>]
    ? Query<ArrayItemType<TValue> | TNull>
    : [TValue] extends [ValidEntity<TValue>]
      ? EntityHandle<TValue | TNull>
      : never;

type __TestEntityHandle = Assert<
  Equal<
    {a: ScalarHandle<number>; b: ScalarHandle<string>},
    EntityHandle<{a: number; b: string}>
  >
>;

type Any<T> = 0 extends 1 & T ? true : false;

export type ValidValue<T> = SingleLiteralValue | ValidEntity<T>;
export type Handle<T extends ValidValue<T>> =
  Any<T> extends true
    ? any
    : [T] extends [SingleLiteralValue]
      ? ScalarHandle<T>
      : [T] extends [ValidEntity<T>]
        ? EntityHandle<T>
        : never;
type __TestHandle = Assert<
  [
    Equal<Expr<number>, Handle<number>>,
    Equal<{a: ScalarHandle<boolean>}, Handle<{a: boolean}>>,
  ]
>;

export type EntityMapping = Record<string, SingleScalarOperand>;
export type ScalarMapping = SingleScalarOperand;
export type NumericMapping = SingleScalarOperand<number | null>;
export type Mapping = ScalarMapping | EntityMapping | EntityHandle<object>;

export type MapValueFn<
  Input extends ValidValue<Input>,
  Result extends Mapping,
> = (x: Handle<Input>) => Result;
export type MapScalarFn<
  Input extends ValidValue<Input>,
  Result extends ScalarMapping,
> = (x: Handle<Input>) => Result;
export type MapScalarArrayFn<
  Input extends ValidValue<Input>,
  Result extends readonly ScalarMapping[] | ScalarMapping,
> = (x: Handle<Input>) => Result;
export type MapQueryFn<
  Input extends ValidValue<Input>,
  Result extends ValidValue<Result>,
> = (x: Handle<Input>) => Query<Result>;
export type JoinMapFn<
  Left extends ValidValue<Left>,
  Right extends ValidValue<Right>,
  TMapping extends Mapping,
> = (left: Handle<Left>, right: Handle<Right>) => TMapping;

export type FilterFn<T extends ValidValue<T>> = (
  x: Handle<T>
) => SingleScalarOperand<boolean | null>;
export type JoinFilterFn<
  Left extends ValidValue<Left>,
  Right extends ValidValue<Right>,
> = (
  left: Handle<Left>,
  right: Handle<Right>
) => SingleScalarOperand<boolean | null>;

// todo: typed Expr
type InferScalarValue<T extends SingleScalarOperand<any>> = [T] extends [
  SingleScalarOperand<infer K>,
]
  ? K
  : never;
type __TestInferScalarValue = Assert<Equal<InferScalarValue<number>, number>>;

type InferEntityProp<T> = [T] extends [SingleScalarOperand]
  ? InferScalarValue<T>
  : [T] extends [Query<any>]
    ? QueryValue<T>[]
    : ConvertEntityMappingToObjectValue<T>;

type ConvertEntityMappingToObjectValue<T> = {
  [K in keyof T]: InferEntityProp<T[K]>;
};
type __TestConvertObjectMappingToObjectValue = Assert<
  [
    Equal<
      {a: 1; b: string},
      ConvertEntityMappingToObjectValue<{a: 1; b: string}>
    >,
  ]
>;

export type ConvertScalarMappingToScalarValue<
  T extends SingleScalarOperand<any>,
> = T extends SingleScalarOperand<infer S> ? S : never;

export type ConvertMappingToValue<T extends Mapping> =
  IsAny<T> extends true
    ? any
    : [T] extends [SingleScalarOperand]
      ? ConvertScalarMappingToScalarValue<T>
      : ConvertEntityMappingToObjectValue<T>;
type __TestConvertMappingToValue = Assert<
  [Equal<{a: 1; b: string}, ConvertMappingToValue<{a: 1; b: string}>>]
>;

export type Expand<T> =
  IsAny<T> extends true
    ? any
    : T extends Date
      ? T
      : T extends infer O
        ? {[K in keyof O]: O[K]}
        : never;

type __TestQuery = [
  Query<number>,
  Query<string>,
  Query<boolean>,
  Query<User>,
  Assert<
    [
      Equal<QueryValue<typeof x1>, {b: number | null}>,
      Equal<QueryValue<typeof x2>, User>,
      Equal<QueryValue<typeof x3>, Post>,
      Equal<QueryValue<typeof x4>, Comment>,
      Equal<QueryValue<typeof x5>, {a: number; b: {c: number}}>,
      Equal<
        QueryValue<typeof x6>,
        {
          id: number;
          author_id: number;
          text: string;
          author: User;
          post: Post;
          title: string;
          comments: Comment[];
        }
      >,
      Equal<QueryValue<typeof x7>, SelfRef>,
    ]
  >,
];

export type QueryValue<T extends Query<any>> =
  T extends Query<infer R> ? R : never;

/////////////////////////////////////////////////////////

interface User {
  id: number;
  posts: Post[];
  comments: Comment[];
}

interface Post {
  id: number;
  author_id: number;
  title: string;

  author: User;
  comments: Comment[];
}

interface Comment {
  id: number;
  author_id: number;
  text: string;

  author: User;
  post: Post;
}

interface SelfRef {
  id: number;

  ref: SelfRef;
}

const q1: Query<Post> = 1 as any;
const q2: Query<SelfRef> = 1 as any;

const x1 = q1.map(x => ({b: x.author.posts.map(y => y.id).first(y => y)}));
const x2 = q1.map(x => x.author);
const x3 = q1.flatMap(x => x.author.posts);
const x4 = q1.flatMap(x => x.comments).map(x => ({...x}));
const x5 = q1.map(() => ({a: 1, b: {c: 2}}));
const x6 = q1.flatMap(x => x.comments).map(x => ({...x.post, ...x}));
const x7 = q2.map(x => x);
