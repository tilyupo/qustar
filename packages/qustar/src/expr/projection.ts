import {ScalarType, SingleScalarType} from '../literal';
import {Expr, LocatorExpr} from './expr';
import {Ref} from './schema';

export type Projection = ScalarProjection | ObjectProjection;

export type PropPath = string[];

export interface GenericProjection<TType extends string> {
  readonly type: TType;
}

export interface ScalarProjection extends GenericProjection<'scalar'> {
  readonly scalarType: ScalarType;
  readonly expr: Expr<any>;
}

export interface GenericProjectionProp<TType extends string> {
  readonly type: TType;
}

export interface SinglePropProjection extends GenericProjectionProp<'single'> {
  readonly expr: Expr<any>;
  readonly path: PropPath;
  readonly scalarType: SingleScalarType;
}

// no path because nested wildcards are not supported in SQL
// so, only from root to root wildcards are supported
export interface WildcardPropProjection
  extends GenericProjectionProp<'wildcard'> {
  readonly source: LocatorExpr<any>;
}

export type PropProjection = SinglePropProjection | WildcardPropProjection;

export interface ObjectProjection extends GenericProjection<'object'> {
  readonly props: readonly PropProjection[];
  readonly refs: readonly Ref[];
  readonly nullable: boolean;
}
