import {assertNever} from './utils.js';

export interface GenericScalarType<TType extends string> {
  readonly type: TType;
  readonly nullable: boolean;
}

export interface GenericArrayScalarType<TScalarType extends SingleScalarType>
  extends GenericScalarType<'array'> {
  readonly itemType: TScalarType;
}

export interface Char extends GenericScalarType<'char'> {
  readonly n: number;
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

export type SingleLiteralValue = InferLiteralValue<StaticSingleLiteral>;
export type ArrayLiteralValue = InferLiteralValue<ArrayLiteral>;
export type LiteralValue = SingleLiteralValue | ArrayLiteralValue;

export interface BooleanLiteral
  extends GenericLiteral<GenericScalarType<'boolean'>, boolean> {}
export interface NullLiteral
  extends GenericLiteral<GenericScalarType<'null'>, null> {}
export interface UuidLiteral
  extends GenericLiteral<GenericScalarType<'uuid'>, string> {}
export interface I8Literal
  extends GenericLiteral<GenericScalarType<'i8'>, number> {}
export interface I16Literal
  extends GenericLiteral<GenericScalarType<'i16'>, number> {}
export interface I32Literal
  extends GenericLiteral<GenericScalarType<'i32'>, number> {}
export interface I64Literal
  extends GenericLiteral<GenericScalarType<'i64'>, number> {}
export interface U8Literal
  extends GenericLiteral<GenericScalarType<'u8'>, number> {}
export interface U16Literal
  extends GenericLiteral<GenericScalarType<'u16'>, number> {}
export interface U32Literal
  extends GenericLiteral<GenericScalarType<'u32'>, number> {}
export interface U64Literal
  extends GenericLiteral<GenericScalarType<'u64'>, number> {}
export interface F32Literal
  extends GenericLiteral<GenericScalarType<'f32'>, number> {}
export interface F64Literal
  extends GenericLiteral<GenericScalarType<'f64'>, number> {}
export interface DateLiteral
  extends GenericLiteral<GenericScalarType<'date'>, Date> {}
export interface TimeLiteral
  extends GenericLiteral<GenericScalarType<'time'>, number> {}
export interface TimetzLiteral
  extends GenericLiteral<GenericScalarType<'timetz'>, number> {}
export interface TimestampLiteral
  extends GenericLiteral<GenericScalarType<'timestamp'>, Date> {}
export interface TimestamptzLiteral
  extends GenericLiteral<GenericScalarType<'timestamptz'>, Date> {}
export interface DynamicLiteral
  extends GenericLiteral<GenericScalarType<'dynamic'>, SingleLiteralValue> {}
export interface TextLiteral
  extends GenericLiteral<GenericScalarType<'text'>, string> {}
export interface CharLiteral extends GenericLiteral<Char, string> {}

export type StaticSingleLiteral =
  | BooleanLiteral
  | NullLiteral
  | UuidLiteral
  | I8Literal
  | I16Literal
  | I32Literal
  | I64Literal
  | U8Literal
  | U16Literal
  | U32Literal
  | U64Literal
  | F32Literal
  | F64Literal
  | DateLiteral
  | TimeLiteral
  | TimetzLiteral
  | TimestampLiteral
  | TimestamptzLiteral
  | TextLiteral
  | CharLiteral;

export type SingleLiteral = StaticSingleLiteral | DynamicLiteral;

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

export function inferLiteral(value: LiteralValue): Literal {
  if (value instanceof Date) {
    return {
      type: {type: 'date', nullable: false},
      value,
    };
  }

  if (typeof value === 'string') {
    return {
      type: {type: 'text', nullable: false},
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
