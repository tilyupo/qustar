import {ScalarType} from '../literal';

export interface ShapeVisitor<T> {
  scalar(shape: ScalarShape): T;
  object(shape: ObjectShape): T;
  query(shape: QueryShape): T;
}

export abstract class Shape {
  constructor(public readonly nullable: boolean) {}

  abstract visit<T>(visitor: ShapeVisitor<T>): T;
}

export class ScalarShape extends Shape {
  constructor(public readonly type: ScalarType) {
    super(type.nullable);
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
  constructor({props, nullable}: ObjectShapeOptions) {
    super(nullable);

    this.props = props;
  }

  visit<T>(visitor: ShapeVisitor<T>): T {
    return visitor.object(this);
  }
}

export interface QueryShapeOptions {
  readonly valueShape: Shape;
  readonly nullable: boolean;
}

export class QueryShape extends Shape {
  public readonly valueShape: Shape;

  constructor({valueShape, nullable}: QueryShapeOptions) {
    super(nullable);

    this.valueShape = valueShape;
  }

  visit<T>(visitor: ShapeVisitor<T>): T {
    return visitor.query(this);
  }
}
