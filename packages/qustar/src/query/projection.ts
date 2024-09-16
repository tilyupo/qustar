import {ScalarType, SingleScalarType} from '../literal.js';
import {Expr} from './expr.js';
import {Ref} from './schema.js';

export interface ProjectionVisitor<T> {
  scalar(proj: ScalarProjection): T;
  object(proj: ObjectProjection): T;
}

export abstract class Projection {
  constructor(public readonly nullable: boolean) {}

  abstract visit<T>(visitor: ProjectionVisitor<T>): T;
}

export type PropPath = string[];

export interface ScalarProjectionOptions {
  readonly scalarType: ScalarType;
  readonly expr: Expr<any>;
}

export class ScalarProjection extends Projection {
  public readonly scalarType: ScalarType;
  public readonly expr: Expr<any>;

  constructor(options: ScalarProjectionOptions) {
    super(options.scalarType.nullable);

    this.scalarType = options.scalarType;
    this.expr = options.expr;
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.scalar(this);
  }
}

export interface PropProjection {
  readonly expr: Expr<any>;
  readonly path: PropPath;
  readonly scalarType: SingleScalarType;
}

export interface ObjectProjectionOptions {
  readonly props: readonly PropProjection[];
  readonly refs: readonly Ref[];
  readonly nullable: boolean;
}

export class ObjectProjection extends Projection {
  public readonly props: readonly PropProjection[];
  public readonly refs: readonly Ref[];

  constructor(options: ObjectProjectionOptions) {
    super(options.nullable);

    this.props = options.props;
    this.refs = options.refs;
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.object(this);
  }
}
