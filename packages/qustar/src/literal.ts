import {assertNever} from './utils.js';

export interface GenericScalarType<TType extends string> {
  readonly type: TType;
  readonly nullable: boolean;
}

export interface GenericArrayScalarType<TScalarType extends SingleScalarType>
  extends GenericScalarType<'array'> {
  readonly itemType: TScalarType;
}

export type SingleScalarType = InferScalarType<SingleLiteral>;
export type ArrayScalarType = InferScalarType<ArrayLiteral>;
export type ScalarType = SingleScalarType | ArrayScalarType;

type InferScalarType<TType extends GenericLiteral<any, any>> =
  TType extends GenericLiteral<infer TScalarType, any> ? TScalarType : never;

export interface GenericLiteral<
  TType extends GenericScalarType<string>,
  TValue,
> {
  readonly type: TType;
  readonly value: TValue;
}

export type SingleLiteralValue = InferLiteralValue<SingleLiteral>;
export type ArrayLiteralValue = InferLiteralValue<ArrayLiteral>;
export type LiteralValue = SingleLiteralValue | ArrayLiteralValue;

export interface BooleanScalarType extends GenericScalarType<'boolean'> {}
export interface NullScalarType extends GenericScalarType<'null'> {}
export interface StringScalarType extends GenericScalarType<'string'> {}
export interface Int8ScalarType extends GenericScalarType<'i8'> {}
export interface Int16ScalarType extends GenericScalarType<'i16'> {}
export interface Int32ScalarType extends GenericScalarType<'i32'> {}
export interface Int64ScalarType extends GenericScalarType<'i64'> {}
export interface Float32ScalarType extends GenericScalarType<'f32'> {}
export interface Float64ScalarType extends GenericScalarType<'f64'> {}

export type NumericScalarType =
  | Int8ScalarType
  | Int16ScalarType
  | Int32ScalarType
  | Int64ScalarType
  | Float32ScalarType
  | Float64ScalarType;

export interface BooleanLiteral
  extends GenericLiteral<BooleanScalarType, boolean> {}
export interface NullLiteral extends GenericLiteral<NullScalarType, null> {}
export interface I8Literal extends GenericLiteral<Int8ScalarType, number> {}
export interface I16Literal extends GenericLiteral<Int16ScalarType, number> {}
export interface I32Literal extends GenericLiteral<Int32ScalarType, number> {}
export interface I64Literal extends GenericLiteral<Int64ScalarType, number> {}
export interface F32Literal extends GenericLiteral<Float32ScalarType, number> {}
export interface F64Literal extends GenericLiteral<Float64ScalarType, number> {}
export interface StringLiteral
  extends GenericLiteral<StringScalarType, string> {}

export type SingleLiteral =
  | BooleanLiteral
  | NullLiteral
  | I8Literal
  | I16Literal
  | I32Literal
  | I64Literal
  | F32Literal
  | F64Literal
  | StringLiteral;

export type ArrayLiteral = InferArrayLiteral<SingleLiteral>;

export type Literal = SingleLiteral | ArrayLiteral;

// infer

type InferLiteralValue<T extends GenericLiteral<any, any>> =
  T extends GenericLiteral<any, infer TValue> ? TValue : never;

type InferArrayLiteral<T extends GenericLiteral<any, any>> =
  T extends GenericLiteral<infer TScalarType, infer TLiteralValue>
    ? TScalarType extends SingleScalarType
      ? GenericLiteral<GenericArrayScalarType<TScalarType>, TLiteralValue[]>
      : never
    : never;

export function assertArrayLiteral(
  literal: Literal
): asserts literal is ArrayLiteral {
  if (literal.type.type !== 'array') {
    throw new Error('literal is not an array: ' + literal.type.type);
  }
}

export function assertSingleLiteral(
  literal: Literal
): asserts literal is SingleLiteral {
  if (literal.type.type === 'array') {
    throw new Error('literal is an array');
  }
}

export function inferSingleLiteral(value: SingleLiteralValue): SingleLiteral {
  // todo: add date support

  if (typeof value === 'string') {
    return {
      type: {type: 'string', nullable: false},
      value,
    };
  }

  if (typeof value === 'number') {
    if (Number.isSafeInteger(value)) {
      return {
        type: {type: 'i64', nullable: false},
        value,
      };
    } else if (Number.isFinite(value)) {
      return {
        type: {type: 'f64', nullable: false},
        value,
      };
    } else if (Number.isNaN(value)) {
      throw new Error('NaN is not supported');
    } else if (Number.isInteger(value)) {
      throw new Error('unsafe integer is not supported');
    } else {
      throw new Error('unsupported number: ' + value);
    }
  }

  if (typeof value === 'boolean') {
    return {
      type: {type: 'boolean', nullable: false},
      value,
    };
  }

  if (value === null) {
    return {
      type: {type: 'null', nullable: true},
      value,
    };
  }

  return assertNever(value, 'unsupported type of the value: ' + typeof value);
}

export function inferLiteral(value: LiteralValue): Literal {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    value === null
  ) {
    return inferSingleLiteral(value);
  }

  if (Array.isArray(value)) {
    const itemTypes = value.map(inferLiteral);

    if (itemTypes.length === 0) {
      throw new Error('empty literal arrays are not supported');
    }

    if (new Set(itemTypes.map(x => x.type.type)).size > 1) {
      throw new Error('array literals with mixed item type are not supported');
    }

    // all items are of the same type and at least one element in array (checks above)
    const firstItemType = itemTypes[0].type;

    if (firstItemType.type === 'array') {
      throw new Error('nested array are not supported in literal types');
    }

    const itemType: SingleScalarType = {
      ...firstItemType,
      nullable: itemTypes.some(x => x.type.nullable),
    };
    const arrayScalarType: ArrayScalarType = {
      type: 'array',
      nullable: false,
      itemType: itemType,
    } as any;

    const literal: ArrayLiteral = {
      type: arrayScalarType,
      value: value,
    } as ArrayLiteral;

    return literal;
  }

  return assertNever(value, 'unsupported type of the value: ' + typeof value);
}

export function isPrimitive(value: unknown) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value === null
  );
}

export function isObject(value: unknown) {
  return typeof value === 'object' && !isPrimitive(value);
}
