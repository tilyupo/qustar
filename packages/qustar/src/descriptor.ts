import {SingleLiteral, SingleLiteralValue, SingleScalarType} from './literal';
import {Query} from './query/query';
import {Field, Ref, Schema} from './query/schema';
import {IsAny, JoinFilterFn} from './types/query';
import {assert} from './utils';

export interface RefOptions<T> {
  readonly references: () => Query<T>;
  readonly condition: JoinFilterFn<any, any>;
}

export interface ScalarPropType {
  readonly type: 'scalar';
  readonly scalarTypeType: Exclude<SingleLiteral['type']['type'], 'null'>;
}

export interface ForwardRefPropType {
  readonly type: 'forward_ref';
  readonly options: RefOptions<any>;
}

export interface BackRefPropType {
  readonly type: 'back_ref';
  readonly options: RefOptions<any>;
}

export type PropType = ScalarPropType | ForwardRefPropType | BackRefPropType;

export class Prop<
  TJsType,
  TIsGenerated extends boolean,
  TIsRef extends boolean,
> {
  __jsType?: TJsType;
  __jsNull?: null extends TJsType ? 1 : 0;

  static i8(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'i8'}, false, false);
  }
  static i16(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'i16'}, false, false);
  }
  static i32(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'i32'}, false, false);
  }
  static i64(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'i64'}, false, false);
  }
  static f32(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'f32'}, false, false);
  }
  static f64(): Prop<number, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'f64'}, false, false);
  }
  static string(): Prop<string, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'string'}, false, false);
  }
  static boolean(): Prop<boolean, false, false> {
    return new Prop({type: 'scalar', scalarTypeType: 'boolean'}, false, false);
  }

  static ref<T>(options: RefOptions<T>): Prop<T, false, true> {
    return new Prop({type: 'forward_ref', options}, false, false);
  }

  static backRef<T>(options: RefOptions<T>): Prop<T[], false, true> {
    return new Prop({type: 'back_ref', options}, false, false);
  }

  constructor(
    public readonly type: PropType,
    public readonly nullable: boolean,
    public readonly isGenerated: boolean
  ) {}

  null(): Prop<TJsType | null, TIsGenerated, TIsRef> {
    assert(this.type.type !== 'back_ref', 'back ref cannot be nullable');

    return new Prop(this.type, true, this.isGenerated);
  }

  notNull(): Prop<TJsType | null, TIsGenerated, TIsRef> {
    return new Prop(this.type, true, this.isGenerated);
  }

  generated(): Prop<TJsType, true, TIsRef> {
    return new Prop(this.type, this.nullable, true);
  }
}

export type EntityDescriptor = Record<string, Prop<any, any, any>>;

export interface Table<TSchema extends EntityDescriptor> {
  readonly name: string;
  readonly schema: TSchema;
}

export type DeriveEntity<T extends EntityDescriptor> = {
  [K in keyof T]: DeriveEntityPropertyValue<T[K]>;
};

export type DeriveInsertEntity<T extends EntityDescriptor> = {
  // required non ref/generated fields
  [K in keyof T as T[K] extends Prop<any, infer TIsGen, infer TIsRef>
    ? TIsGen extends true
      ? never
      : TIsRef extends true
        ? never
        : null extends T[K]
          ? never
          : K
    : never]: T[K] extends Prop<infer TType, any, any> ? TType : never;
} & {
  // optional generated fields
  [K in keyof T as T[K] extends Prop<any, infer TIsGen, any>
    ? TIsGen extends true
      ? K
      : null extends T[K]
        ? K
        : never
    : never]?: T[K] extends Prop<infer TType, any, any> ? TType : never;
};

export type DeriveEntityPropertyValue<T extends Prop<any, any, any>> =
  IsAny<T> extends true
    ? any
    : T extends Prop<infer TType, any, any>
      ? TType
      : never;

export type DeriveEntityDescriptor<T extends object> = {
  [K in keyof T]: Prop<T[K], any, any>;
};

type ConsolidateBoolean<T> = T extends boolean ? boolean : T;

export type ScalarDescriptor<
  T extends SingleLiteralValue = SingleLiteralValue,
  TActual = Exclude<T, null>,
  TNull = null extends T ? null : never,
> =
  | (TActual extends any
      ? Prop<ConsolidateBoolean<TActual> | TNull, any, any>
      : never)
  | (TActual extends any ? Prop<ConsolidateBoolean<TActual>, any, any> : never);

type X = ScalarDescriptor;

export function scalarDescriptorToScalarType(
  prop: ScalarDescriptor
): SingleScalarType {
  assert(
    prop.type.type === 'scalar',
    'expected scalar schema, but got: ' + prop.type.type
  );

  return {
    type: prop.type.scalarTypeType,
    nullable: prop.nullable,
  };
}

export function toSchema(
  table: () => Query<any>,
  columns: EntityDescriptor
): Schema {
  const descriptors = Object.entries(columns ?? {}).map(([name, prop]) => ({
    name,
    type: prop.type,
    nullable: prop.nullable,
    isGenerated: prop.isGenerated,
  }));
  const scalarDescriptors = descriptors
    .filter(({type}) => type.type === 'scalar')
    .map(descriptor => {
      return {...descriptor, type: descriptor.type as ScalarPropType};
    });
  if (scalarDescriptors.length === 0) {
    throw new Error('schema must define at least one field');
  }

  return {
    fields: scalarDescriptors.map(
      ({isGenerated, name, nullable, type}): Field => ({
        name,
        isGenerated,
        scalarType: {
          type: type.scalarTypeType,
          nullable,
        },
      })
    ),
    refs: [
      ...descriptors
        .filter(({type}) => type.type === 'forward_ref')
        .map(descriptor => {
          return {
            ...descriptor,
            type: descriptor.type as ForwardRefPropType,
          };
        })
        .map(
          (x): Ref => ({
            type: 'forward_ref',
            child: table,
            parent: x.type.options.references,
            nullable: x.nullable,
            condition: (a, b) => x.type.options.condition(b, a),
            path: [x.name],
          })
        ),
      ...descriptors
        .filter(({type}) => type.type === 'back_ref')
        .map(descriptor => {
          return {
            ...descriptor,
            type: descriptor.type as BackRefPropType,
          };
        })
        .map(
          (x): Ref => ({
            type: 'back_ref',
            child: x.type.options.references,
            nullable: false,
            parent: table,
            condition: x.type.options.condition,
            path: [x.name],
          })
        ),
    ],
  };
}
