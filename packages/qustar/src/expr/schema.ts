import {
  ArrayLiteralValue,
  SingleLiteralValue,
  SingleScalarType,
} from '../literal.js';
import {JoinFilterFn} from '../types.js';
import {ScalarOperand} from './expr.js';
import {PropPath} from './projection.js';
import {Query} from './query.js';

export interface Field {
  readonly scalarType: SingleScalarType;
  readonly name: string;
}

export interface Schema {
  readonly fields: readonly Field[];
  readonly refs: readonly Ref[];
}

export interface SqlTemplate {
  readonly src: TemplateStringsArray;
  readonly args: Array<ScalarOperand<SingleLiteralValue> | ArrayLiteralValue>;
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
