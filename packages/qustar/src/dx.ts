import {match} from 'ts-pattern';
import {SqlCommand} from './data-source';
import {ProxyQuery, Query, QuerySource} from './expr/query';
import {ChildrenRef, Field, ParentRef, Schema} from './expr/schema';
import {SingleScalarType} from './literal';
import {JoinFilterFn, Value} from './types';

export interface GenericPropertyDescriptor<TType extends string> {
  readonly type: TType;
}

export interface ParentPropertyDescriptor
  extends GenericPropertyDescriptor<'parent'> {
  readonly required?: boolean;
  readonly parent: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

export interface ChildrenPropertyDescriptor
  extends GenericPropertyDescriptor<'children'> {
  readonly child: () => Query<any>;
  readonly condition: JoinFilterFn<any, any>;
}

type RefPropertyDescriptor =
  | ParentPropertyDescriptor
  | ChildrenPropertyDescriptor;

export type ScalarPropertyDescriptor = Omit<SingleScalarType, 'nullable'> & {
  nullable?: boolean;
};

export type PropertyDescriptor =
  | RefPropertyDescriptor
  | ScalarPropertyDescriptor;

export type TableProperties = Readonly<Record<string, PropertyDescriptor>>;

export type TableSchema =
  | {readonly dynamic?: true | undefined; schema?: TableProperties | undefined}
  | {readonly dynamic: false; schema: TableProperties};

export type TableSource =
  | {readonly name: string; readonly sql?: undefined}
  | {readonly name?: undefined; readonly sql: string | SqlCommand};

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
  const {dynamic, schema: columns} = descriptor;
  const descriptors = Object.entries(columns ?? {});
  const schema: (table: () => Query<any>) => Schema = table => ({
    dynamic: dynamic ?? true,
    fields: descriptors
      .filter(
        (entry): entry is [string, SingleScalarType] =>
          entry[1].type !== 'parent' && entry[1].type !== 'children'
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
        (entry): entry is [string, RefPropertyDescriptor] =>
          entry[1].type === 'parent' || entry[1].type === 'children'
      )
      .map(([property, desc]) =>
        match(desc)
          .with(
            {type: 'parent'},
            (x): ParentRef => ({
              type: 'parent',
              child: table,
              nullable: x.required !== true,
              parent: x.parent,
              path: [property],
              condition: x.condition,
            })
          )
          .with(
            {type: 'children'},
            (x): ChildrenRef => ({
              type: 'children',
              child: x.child,
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
            command: {
              src: descriptor.sql,
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
          view: {
            command: descriptor.sql,
            schema: schema(() => table),
          },
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
