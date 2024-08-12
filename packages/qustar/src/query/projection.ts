import {ScalarType, SingleScalarType} from '../literal.js';
import {Expr} from './expr.js';
import {Ref} from './schema.js';

export type Projection = ScalarProjection | ObjectProjection;

export type PropPath = string[];

export interface GenericProjection<TType extends string> {
  readonly type: TType;
}

export interface ScalarProjection extends GenericProjection<'scalar'> {
  readonly scalarType: ScalarType;
  readonly expr: Expr<any>;
}

export interface PropProjection {
  readonly expr: Expr<any>;
  readonly path: PropPath;
  readonly scalarType: SingleScalarType;
}

export interface ObjectProjection extends GenericProjection<'object'> {
  readonly props: readonly PropProjection[];
  readonly refs: readonly Ref[];
  readonly nullable: boolean;
}
