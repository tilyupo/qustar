import {match} from 'ts-pattern';
import {ProxyQuery, Query, QuerySource} from './expr/query.js';
import {ChildrenRef, Field, ParentRef, Schema, View} from './expr/schema.js';
import {SingleScalarType} from './literal.js';
import {JoinFilterFn, Value} from './types.js';

export interface GenericPropertyDescriptor<TType extends string> {
  readonly type: TType;
}

export interface RefPropertyDescriptor
  extends GenericPropertyDescriptor<'ref'> {
  readonly required?: boolean;
  readonly references: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

export interface BackRefPropertyDescriptor
  extends GenericPropertyDescriptor<'back_ref'> {
  readonly references: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

type NavPropertyDescriptor = RefPropertyDescriptor | BackRefPropertyDescriptor;

export type ScalarPropertyDescriptor = Omit<SingleScalarType, 'nullable'> & {
  nullable?: boolean;
};

export type PropertyDescriptor =
  | NavPropertyDescriptor
  | ScalarPropertyDescriptor;

export type TableProperties = Readonly<Record<string, PropertyDescriptor>>;

export type TableSchema =
  | {
      readonly additionalProperties?: true | undefined;
      schema?: TableProperties | undefined;
    }
  | {readonly additionalProperties: false; schema: TableProperties};

export type TableSource =
  | {readonly name: string; readonly sql?: undefined}
  | {readonly name?: undefined; readonly sql: string | View};

export type TableDescriptor = TableSchema & TableSource;

export function collection<T extends Value<T> = any>(
  collectionName: string
): Query<T>;
export function collection<T extends Value<T> = any>(
  descriptor: TableDescriptor
): Query<T>;
export function collection<T extends Value<T> = any>(
  descriptor: TableDescriptor | string
): Query<T> {
  if (typeof descriptor === 'string') {
    descriptor = {name: descriptor};
  }
  const {additionalProperties, schema: columns} = descriptor;
  const descriptors = Object.entries(columns ?? {});
  const schema: (table: () => Query<any>) => Schema = table => ({
    additionalProperties: additionalProperties ?? !columns,
    fields: descriptors
      .filter(
        (entry): entry is [string, SingleScalarType] =>
          entry[1].type !== 'ref' && entry[1].type !== 'back_ref'
      )
      .map(
        ([property, x]): Field => ({
          name: property,
          scalarType: {
            ...x,
            nullable: x.nullable ?? false,
          },
        })
      ),
    refs: descriptors
      .filter(
        (entry): entry is [string, NavPropertyDescriptor] =>
          entry[1].type === 'ref' || entry[1].type === 'back_ref'
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
  });
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
