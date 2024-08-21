import {ScalarType} from '../literal';

export interface ShapeVisitor<T> {
  scalar(shape: ScalarShape): T;
  object(shape: ObjectShape): T;
  query(shape: QueryShape): T;
}

export abstract class Shape {
  abstract visit<T>(visitor: ShapeVisitor<T>): T;
}

export class ScalarShape extends Shape {
  constructor(public readonly type: ScalarType) {
    super();
  }

  visit<T>(visitor: ShapeVisitor<T>): T {
    return visitor.scalar(this);
  }
}

export interface ObjectShapeProp {
  readonly name: string;
  readonly shape: () => Shape;
}

export interface ObjectShapeOptions {
  readonly props: readonly ObjectShapeProp[];
  readonly nullable: boolean;
}

export class ObjectShape extends Shape {
  public readonly props: readonly ObjectShapeProp[];
  public nullable: boolean;
  constructor({props, nullable}: ObjectShapeOptions) {
    super();

    this.props = props;
    this.nullable = nullable;
  }

  visit<T>(visitor: ShapeVisitor<T>): T {
    return visitor.object(this);
  }
}

export class QueryShape extends Shape {
  constructor(public readonly valueShape: Shape) {
    super();
  }

  visit<T>(visitor: ShapeVisitor<T>): T {
    return visitor.query(this);
  }
}
