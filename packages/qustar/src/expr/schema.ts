import {SqlCommand} from '../data-source';
import {SingleScalarType} from '../literal';
import {JoinFilterFn} from '../types';
import {PropPath} from './projection';
import {Query} from './query';

export interface Field {
  readonly scalarType: SingleScalarType;
  readonly name: string;
}

export interface Schema {
  readonly dynamic: boolean;
  readonly fields: readonly Field[];
  readonly refs: readonly Ref[];
}

export interface Collection {
  readonly name: string;
  readonly schema: Schema;
}

export interface View {
  readonly command: SqlCommand;
  readonly schema: Schema;
}

export interface GenericRef<TType extends string> {
  readonly type: TType;
  // ref is always defined at root (so path length always
  // equals to one) but when using wildcard projections it
  // can migrate to a nested object. In that case condition
  // should be called with nested object as a handle
  readonly path: PropPath;

  readonly child: () => Query<any>;
  readonly parent: () => Query<any>;

  readonly condition: JoinFilterFn<any, any>;
}

export interface ParentRef extends GenericRef<'parent'> {
  readonly nullable: boolean;
}

export interface ChildrenRef extends GenericRef<'children'> {
  readonly nullable: false;
}

export type Ref = ParentRef | ChildrenRef;