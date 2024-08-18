import {
  BackRefDescriptor,
  EntityDescriptor,
  ForwardRefDescriptor,
  PropertyValueDescriptor,
  RefDescriptor,
  ScalarDescriptor,
  ScalarLongDescriptor,
  ScalarShortDescriptor,
} from '../descriptor.js';
import {
  BooleanScalarType,
  NumericScalarType,
  TextScalarType,
} from '../literal.js';
import {Query} from '../query/query.js';

// derive entity from schema

export type DeriveEntity<T extends EntityDescriptor> = {
  [K in keyof T]: DerivePropertyValue<T[K]>;
};

type DerivePropertyValue<T extends PropertyValueDescriptor> =
  T extends ScalarDescriptor
    ? DeriveScalar<T>
    : T extends RefDescriptor
      ? DeriveRef<T>
      : never;

type DeriveRef<T extends RefDescriptor> = T extends ForwardRefDescriptor
  ? DeriveForwardRef<T>
  : T extends BackRefDescriptor
    ? DeriveBackRef<T>
    : never;

type DeriveForwardRef<T extends ForwardRefDescriptor> =
  T['required'] extends true
    ? Query.Infer<ReturnType<T['references']>>
    : Query.Infer<ReturnType<T['references']>> | null;

type DeriveBackRef<T extends BackRefDescriptor> = Query.Infer<
  ReturnType<T['references']>
>[];

export type DeriveScalar<T extends ScalarDescriptor> =
  T extends ScalarShortDescriptor
    ? DeriveNonNullableScalar<T>
    : T extends ScalarLongDescriptor
      ? DeriveNullableScalar<T>
      : never;

type DeriveNullableScalar<T extends ScalarLongDescriptor> =
  T['nullable'] extends true
    ? DeriveNonNullableScalar<T['type']> | null
    : DeriveNonNullableScalar<T['type']>;

type DeriveNonNullableScalar<T extends ScalarShortDescriptor> = {
  boolean: boolean;
  i8: number;
  i16: number;
  i32: number;
  i64: number;
  f32: number;
  f64: number;
  text: string;
}[T];

// derive schema from entity

export type ValidateEntity<T> = {
  [K in keyof T]: ValidatePropertyValue<T[K]>;
};

type IsNullable<T> = Extract<T, null> extends never ? false : true;

export type ValidatePropertyValue<T> =
  T extends ReadonlyArray<object>
    ? ValidateBackRef<T>
    : T extends object
      ? ValidateForwardRef<T>
      : T extends null | string | number | boolean
        ? T
        : never;

export type ValidateBackRef<T extends ReadonlyArray<object>> =
  T extends ReadonlyArray<infer TEntity>
    ? TEntity extends object
      ? ValidateEntity<TEntity>[]
      : never
    : never;

export type ValidateForwardRef<T extends object> = ValidateEntity<T>;

export type DeriveEntityDescriptor<T extends ValidateEntity<T>> = {
  [K in keyof T]: DerivePropertyValueDescriptor<T[K]>;
};

export type DerivePropertyValueDescriptor<
  T,
  TNullable extends boolean = IsNullable<T>,
> = T extends string
  ? ScalarDescriptor<TextScalarType, TNullable>
  : T extends number
    ? ScalarDescriptor<NumericScalarType, TNullable>
    : T extends boolean
      ? ScalarDescriptor<BooleanScalarType, TNullable>
      : T extends ReadonlyArray<infer TEntity>
        ? TEntity extends ValidateEntity<TEntity>
          ? BackRefDescriptor<TEntity>
          : never
        : T extends ValidateEntity<T>
          ? TNullable extends true
            ? ForwardRefDescriptor<T, false>
            : ForwardRefDescriptor<T, true>
          : never;
