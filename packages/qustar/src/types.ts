import {Expr} from './expr/expr.js';
import {Query} from './expr/query.js';
import {SingleLiteralValue} from './literal.js';

export type IsAny<a> = 0 extends 1 & a ? true : false;

export type Assert<T extends true[] | true> = T;
export type Not<T extends boolean> = [T] extends [true] ? false : true;
export type Equal<T1, T2> = [T1] extends [T2]
  ? [T2] extends [T1]
    ? true
    : false
  : false;
export type NotEqual<T1, T2> = Not<Equal<T1, T2>>;
export type __TestEqual = Assert<
  [
    Equal<1, 1>,
    NotEqual<number, 1>,
    NotEqual<1, number>,
    Equal<{a: string}, {a: string}>,
  ]
>;

export type Never<T> = [T] extends [never] ? true : false;
export type Ever<T> = Not<Never<T>>;
export type __TestEver = Assert<
  [Equal<Ever<1>, true>, Equal<Ever<never>, false>]
>;

export type ArrayItemType<T extends readonly any[]> = [T] extends [
  ReadonlyArray<infer I>,
]
  ? I
  : never;

export type ScalarHandle<T extends SingleLiteralValue> = Expr<T>;
export type __TestScalarHandle = Assert<
  Equal<Expr<SingleLiteralValue>, ScalarHandle<SingleLiteralValue>>
>;

export type GenericScalar<T extends SingleLiteralValue> = T | Expr<T>;
type Scalar = GenericScalar<SingleLiteralValue>;

type ScalarEntityProperty = SingleLiteralValue;
type NavigationEntityProperty<T> = EntityValue<T> | Array<EntityValue<T>>;
type EntityValue<T> = {
  [K in keyof T]: ScalarEntityProperty | NavigationEntityProperty<T[K]>;
};

type EntityHandle<T extends object> = {
  [K in keyof T]: [T[K]] extends [SingleLiteralValue]
    ? ScalarHandle<T[K]>
    : [T[K]] extends [ReadonlyArray<any>]
      ? Query<ArrayItemType<T[K]>>
      : [T[K]] extends [EntityValue<T[K]>]
        ? EntityHandle<T[K]>
        : never;
};
export type __TestEntityHandle = Assert<
  Equal<
    {a: ScalarHandle<number>; b: ScalarHandle<string>},
    EntityHandle<{a: number; b: string}>
  >
>;

type Any<T> = 0 extends 1 & T ? true : false;

export type Value<T> = SingleLiteralValue | EntityValue<T>;
export type Handle<T extends Value<T>> =
  Any<T> extends true
    ? any
    : [T] extends [SingleLiteralValue]
      ? ScalarHandle<T>
      : [T] extends [EntityValue<T>]
        ? EntityHandle<T>
        : never;
export type __TestHandle = Assert<
  [
    Equal<Expr<number>, Handle<number>>,
    Equal<{a: ScalarHandle<boolean>}, Handle<{a: boolean}>>,
  ]
>;

export type EntityMapping = Record<string, Scalar>;
export type ScalarMapping = Scalar;
export type Mapping = ScalarMapping | EntityMapping | EntityHandle<object>;

export type MapValueFn<Input extends Value<Input>, Result extends Mapping> = (
  x: Handle<Input>
) => Result;
export type MapScalarFn<
  Input extends Value<Input>,
  Result extends ScalarMapping,
> = (x: Handle<Input>) => Result;
export type MapScalarArrayFn<
  Input extends Value<Input>,
  Result extends readonly ScalarMapping[] | ScalarMapping,
> = (x: Handle<Input>) => Result;
export type MapQueryFn<
  Input extends Value<Input>,
  Result extends Value<Result>,
> = (x: Handle<Input>) => Query<Result>;
export type JoinMapFn<
  Left extends Value<Left>,
  Right extends Value<Right>,
  TMapping extends Mapping,
> = (left: Handle<Left>, right: Handle<Right>) => TMapping;

export type FilterFn<T extends Value<T>> = (
  x: Handle<T>
) => GenericScalar<boolean | null>;
export type JoinFilterFn<
  Left extends Value<Left>,
  Right extends Value<Right>,
> = (left: Handle<Left>, right: Handle<Right>) => GenericScalar<boolean | null>;

// todo: typed Expr
type InferScalarValue<T extends GenericScalar<any>> = [T] extends [
  GenericScalar<infer K>,
]
  ? K
  : never;
export type __TestInferScalarValue = Assert<
  Equal<InferScalarValue<number>, number>
>;

// type CleanMappingEntityValue<T> = {
//   [K in keyof T]: [T[K]] extends [Scalar]
//     ? T[K]
//     : [T[K]] extends [Query<any>]
//       ? T[K]
//       : [T[K]] extends [CleanMappingEntityValue<T[K]>]
//         ? T[K]
//         : never;

type CleanMappingEntityValue<T> = {
  [K in keyof T]: [T[K]] extends [Scalar] ? T[K] : never;
};
// export type __TestToCleanObjectValue = Assert<
//   [
//     Equal<
//       CleanMappingEntityValue<{a: number; b: string}>,
//       {a: number; b: string}
//     >,
//     Equal<
//       CleanMappingEntityValue<{a: number; b: {c: number}}>,
//       {a: number; b: {c: number}}
//     >,
//   ]
// >;

type InferEntityProp<T> = [T] extends [Scalar]
  ? InferScalarValue<T>
  : [T] extends [Query<any>]
    ? QueryValue<T>[]
    : [T] extends [CleanMappingEntityValue<T>]
      ? ConvertEntityMappingToObjectValue<T>
      : never;

type ConvertEntityMappingToObjectValue<T extends CleanMappingEntityValue<T>> = {
  [K in keyof T]: InferEntityProp<T[K]>;
};
export type __TestConvertObjectMappingToObjectValue = Assert<
  [
    Equal<
      {a: 1; b: string},
      ConvertEntityMappingToObjectValue<{a: 1; b: string}>
    >,
  ]
>;

export type ConvertScalarMappingToScalarValue<T extends GenericScalar<any>> =
  T extends GenericScalar<infer S> ? S : never;

export type ConvertMappingToValue<T extends Mapping> = any;
//   IsAny<T> extends true
//     ? any
//     : [T] extends [GenericScalar<SingleLiteralValue>]
//       ? ConvertScalarMappingToScalarValue<T>
//       : [T] extends [EntityHandle<infer R>]
//         ? R
//         : [T] extends [CleanMappingEntityValue<T>]
//           ? ConvertEntityMappingToObjectValue<T>
//           : never;
// export type __TestConvertMappingToValue = Assert<
//   [Equal<{a: 1; b: string}, ConvertMappingToValue<{a: 1; b: string}>>]
// >;

export type Expand<T> =
  IsAny<T> extends true
    ? any
    : T extends Date
      ? T
      : T extends infer O
        ? {[K in keyof O]: O[K]}
        : never;

// export type __TestQuery = [
//   Query<number>,
//   Query<string>,
//   Query<boolean>,
//   Query<User>,
//   Assert<
//     [
//       Equal<QueryValue<typeof x1>, {b: number}>,
//       Equal<QueryValue<typeof x2>, User>,
//       Equal<QueryValue<typeof x3>, Post>,
//       Equal<QueryValue<typeof x4>, Comment>,
//       Equal<QueryValue<typeof x5>, {a: number; b: {c: number}}>,
//       Equal<
//         QueryValue<typeof x6>,
//         {
//           id: number;
//           author_id: number;
//           text: string;
//           author: User;
//           post: Post;
//           title: string;
//           comments: Comment[];
//         }
//       >,
//     ]
//   >,
// ];

type QueryValue<T extends Query<any>> = T extends Query<infer R> ? R : never;

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

const q: Query<Post> = 1 as any;

const x1 = q.map(x => ({b: x.author.posts.map(y => y.id).first(y => y)}));
const x2 = q.map(x => x.author);
const x3 = q.flatMap(x => x.author.posts);
const x4 = q.flatMap(x => x.comments).map(x => ({...x}));
const x5 = q.map(() => ({a: 1, b: {c: 2}}));
const x6 = q.flatMap(x => x.comments).map(x => ({...x.post, ...x}));
