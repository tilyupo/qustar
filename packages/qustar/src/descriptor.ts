import {match} from 'ts-pattern';
import {GenericScalarType, ScalarType, SingleScalarType} from './literal.js';
import {Query} from './query/query.js';
import {ChildrenRef, Field, ParentRef, Schema} from './query/schema.js';
import {JoinFilterFn} from './types/query.js';
import {ValidateEntity} from './types/schema.js';

export interface GenericPropertyDescriptor<TType extends string> {
  readonly type: TType;
}

export type ForwardRefDescriptor<
  T extends ValidateEntity<T> = any,
  TRequired extends boolean = boolean,
> = (TRequired extends true
  ? {readonly required: true}
  : {readonly required?: false}) & {
  readonly type: 'ref';
  readonly references: () => Query<T>;
  readonly condition: JoinFilterFn<any, any>;
};

export interface BackRefDescriptor<T extends ValidateEntity<T> = any>
  extends GenericPropertyDescriptor<'back_ref'> {
  readonly references: () => Query<T>;
  readonly condition: JoinFilterFn<any, any>;
}

export type RefDescriptor = ForwardRefDescriptor | BackRefDescriptor;

export type ScalarShortDescriptor<
  T extends GenericScalarType<string> = SingleScalarType,
  TNullable extends boolean = boolean,
> = TNullable extends true ? never : T['type'];

export type ScalarLongDescriptor<
  T extends GenericScalarType<string> = SingleScalarType,
  TNullable extends boolean = boolean,
> = TNullable extends true
  ? Omit<T, 'nullable'> & {
      nullable: true;
    }
  : Omit<T, 'nullable'> & {
      nullable?: false;
    };

export type ScalarDescriptor<
  T extends GenericScalarType<string> = SingleScalarType,
  TNullable extends boolean = boolean,
> = ScalarShortDescriptor<T, TNullable> | ScalarLongDescriptor<T, TNullable>;

export type PropertyValueDescriptor = RefDescriptor | ScalarDescriptor;

export type EntityDescriptor = Readonly<
  Record<string, PropertyValueDescriptor>
>;

export interface Table<TSchema extends EntityDescriptor> {
  readonly name: string;
  readonly schema: TSchema;
}

export function scalarDescriptorToScalarType(
  descriptor: ScalarDescriptor
): ScalarType {
  if (typeof descriptor === 'string') {
    return {type: descriptor, nullable: false};
  } else {
    return {...descriptor, nullable: descriptor.nullable ?? false};
  }
}

export function toInternalSchema(
  table: () => Query<any>,
  columns: EntityDescriptor
): Schema {
  const descriptors = Object.entries(columns ?? {});
  const nonRefDescriptors = descriptors
    .filter(
      (entry): entry is [string, ScalarDescriptor] =>
        typeof entry[1] === 'string' ||
        (entry[1].type !== 'ref' && entry[1].type !== 'back_ref')
    )
    .map((entry): [string, ScalarType] => {
      return [entry[0], scalarDescriptorToScalarType(entry[1])];
    });
  if (nonRefDescriptors.length === 0) {
    throw new Error('schema must define at least one field');
  }

  return {
    fields: nonRefDescriptors.map(
      ([property, x]): Field => ({
        name: property,
        scalarType: {
          ...x,
          nullable: x.nullable ?? false,
        } as SingleScalarType,
      })
    ),
    refs: descriptors
      .filter(
        (entry): entry is [string, RefDescriptor] =>
          typeof entry[1] !== 'string' &&
          (entry[1].type === 'ref' || entry[1].type === 'back_ref')
      )
      .map(([property, desc]) =>
        match(desc)
          .with(
            {type: 'ref'},
            (x): ParentRef => ({
              type: 'parent',
              child: table,
              nullable: x.required !== true,
              parent: x.references,
              path: [property],
              // todo: unify condition orders
              condition: (a, b) => x.condition(b, a),
            })
          )
          .with(
            {type: 'back_ref'},
            (x): ChildrenRef => ({
              type: 'children',
              child: x.references,
              parent: table,
              path: [property],
              condition: x.condition,
              nullable: false,
            })
          )
          .exhaustive()
      ),
  };
}
