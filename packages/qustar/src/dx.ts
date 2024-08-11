import {match} from 'ts-pattern';
import {ProxyQuery, Query, QuerySource} from './expr/query.js';
import {ChildrenRef, Field, ParentRef, Schema, View} from './expr/schema.js';
import {ScalarType, SingleScalarType} from './literal.js';
import {JoinFilterFn, Value} from './types.js';

export interface GenericPropertyDescriptor<TType extends string> {
  readonly type: TType;
}

export interface ForwardRefDescriptor extends GenericPropertyDescriptor<'ref'> {
  readonly required?: boolean;
  readonly references: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

export interface BackRefDescriptor
  extends GenericPropertyDescriptor<'back_ref'> {
  readonly references: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

type RefDescriptor = ForwardRefDescriptor | BackRefDescriptor;

export type ScalarDescriptor =
  | (Omit<SingleScalarType, 'nullable'> & {
      nullable?: boolean;
    })
  | SingleScalarType['type'];

export type Descriptor = RefDescriptor | ScalarDescriptor;

export type TableSchema = Readonly<Record<string, Descriptor>>;

export type TableSource =
  | {readonly name: string; readonly sql?: undefined}
  | {readonly name?: undefined; readonly sql: string | View};

export type TableDescriptor = {readonly schema: TableSchema} & TableSource;

export function scalarDescriptorToScalarType(
  descriptor: ScalarDescriptor
): ScalarType {
  if (typeof descriptor === 'string') {
    return {type: descriptor, nullable: false};
  } else {
    return {...descriptor, nullable: descriptor.nullable ?? false};
  }
}

export function publicSchemaToInternalSchema(
  table: () => Query<any>,
  columns: TableSchema
): Schema {
  const descriptors = Object.entries(columns ?? {});
  const nonRefDescriptors = descriptors
    .filter(
      (entry): entry is [string, ScalarDescriptor | SingleScalarType['type']] =>
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

export function collection<T extends Value<T> = any>(
  descriptor: TableDescriptor
): Query<T>;
export function collection<T extends Value<T> = any>(
  descriptor: TableDescriptor
): Query<T> {
  const schema: (table: () => Query<any>) => Schema = table =>
    publicSchemaToInternalSchema(table, descriptor.schema);
  if (descriptor.name) {
    const table: Query<T> = new ProxyQuery<T>(
      new QuerySource({
        type: 'collection',
        collection: {
          name: descriptor.name,
          schema: schema(() => table),
        },
      })
    );
    return table;
  } else if (descriptor.sql) {
    if (typeof descriptor.sql === 'string') {
      const table: Query<T> = new ProxyQuery<T>(
        new QuerySource({
          type: 'view',
          view: {
            sql: {
              src: {
                raw: [descriptor.sql],
                ...[descriptor.sql],
              },
              args: [],
            },
            schema: schema(() => table),
          },
        })
      );
      return table;
    } else {
      const table: Query<T> = new ProxyQuery<T>(
        new QuerySource({
          type: 'view',
          view: descriptor.sql,
        })
      );
      return table;
    }
  } else {
    throw new Error(
      'invalid collection descriptor: collection name or sql is required'
    );
  }
}
