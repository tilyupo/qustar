import {Expr} from './expr.js';
import {Query} from './query.js';
import {BackRef, ForwardRef} from './schema.js';
import {ObjectShape, Shape} from './shape.js';

export interface ProjectionVisitor<T> {
  expr(projection: ExprProjection): T;
  object(projection: ObjectProjection): T;
  forwardRef(projection: ForwardRefProjection): T;
  backRef(projection: BackRefProjection): T;
  query(projection: QueryProjection): T;
}

export abstract class Projection {
  abstract visit<T>(visitor: ProjectionVisitor<T>): T;

  abstract shape(): Shape;
}

export class ExprProjection extends Projection {
  constructor(public readonly expr: Expr<any>) {
    super();
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.expr(this);
  }

  shape(): Shape {
    return this.expr.shape();
  }
}

export class ForwardRefProjection extends Projection {
  constructor(public readonly ref: ForwardRef) {
    super();
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.forwardRef(this);
  }

  shape(): Shape {
    return this.ref.parent().shape.valueShape;
  }
}

export class BackRefProjection extends Projection {
  constructor(public readonly ref: BackRef) {
    super();
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.backRef(this);
  }

  shape(): Shape {
    return this.ref.parent().shape.valueShape;
  }
}

export interface ObjectProjectionOptions {
  readonly props: readonly ObjectProjectionProp[];
  readonly nullable: boolean;
}

export class ObjectProjection extends Projection {
  readonly props: readonly ObjectProjectionProp[];
  readonly nullable: boolean;

  constructor({props, nullable}: ObjectProjectionOptions) {
    super();

    this.props = props;
    this.nullable = nullable;
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.object(this);
  }

  shape(): Shape {
    return new ObjectShape({
      nullable: this.nullable,
      props: this.props.map(prop => ({
        name: prop.name,
        shape: () => prop.projection.shape(),
      })),
    });
  }
}

export interface ObjectProjectionProp {
  readonly name: string;
  readonly projection: Projection;
}

export interface QueryProjectionOptions {
  readonly query: Query<any>;
  readonly nullable: boolean;
}

export class QueryProjection extends Projection {
  public readonly query: Query<any>;
  readonly nullable: boolean;

  constructor({query, nullable}: QueryProjectionOptions) {
    super();
    this.query = query;
    this.nullable = nullable;
  }

  visit<T>(visitor: ProjectionVisitor<T>): T {
    return visitor.query(this);
  }

  shape(): Shape {
    return this.query.shape;
  }
}
