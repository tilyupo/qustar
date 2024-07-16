import seedrandom, {PRNG} from 'seedrandom';
import {match} from 'ts-pattern';
import {staticComments, staticPosts, staticUsers} from '../example-schema';
import {ScalarType, SingleLiteralValue, SingleScalarType} from '../literal';
import {ArrayItemType} from '../types';
import {assert, deepEqual, startsWith} from '../utils';
import {Expr, LiteralExpr, LocatorExpr, isChar, isFloat, isInt} from './expr';
import {
  ObjectProjection,
  Projection,
  PropPath,
  PropProjection,
  ScalarProjection,
  SinglePropProjection,
  WildcardPropProjection,
} from './projection';
import {
  CombineQuery,
  FilterQuery,
  GroupByQuery,
  JoinQuery,
  MapQuery,
  OrderByQuery,
  OrderByTermPrivate,
  PaginationQuery,
  ProxyQuery,
  Query,
  QuerySource,
  UniqueQuery,
  createHandle,
} from './query';
import {ChildrenRef} from './schema';

// shapes

type Shape = ScalarShape | ObjectShape;

interface GenericShape<TType extends string> {
  readonly type: TType;
}

interface ScalarShape extends GenericShape<'scalar'> {
  readonly scalarType: ScalarType;
}

interface GenericShapeProp<TType extends string> {
  readonly type: TType;
}

interface SinglePropShape extends GenericShapeProp<'single'> {
  readonly path: PropPath;
  readonly scalarType: SingleScalarType;
}

interface WildcardPropShape extends GenericShapeProp<'wildcard'> {
  readonly source: ObjectShape;
}

type PropShape = SinglePropShape | WildcardPropShape;

interface ObjectShape extends GenericShape<'object'> {
  readonly props: readonly PropShape[];
  readonly nullable: boolean;
}

// generators

function extractQueries(source: QuerySource): Query<any>[] {
  if (source.inner.type !== 'query') {
    return [];
  }

  return [source.inner.query, ...extractQueries(source.inner.query.source)];
}

export interface GenerationOptions {
  readonly disableFlatMap: boolean;
  readonly disableGroupBy: boolean;
  readonly maxDepth: number;
}

export class GenContext {
  public readonly options: GenerationOptions;

  constructor(
    public readonly rand: PRNG,
    public readonly deps: Deps,
    options: Partial<GenerationOptions>,
    public readonly queryDepth = 0
  ) {
    this.options = {
      maxDepth: Number.MAX_SAFE_INTEGER,
      disableFlatMap: false,
      disableGroupBy: false,
      ...options,
    };
  }

  with(deps: Deps): GenContext {
    return new GenContext(
      this.rand,
      combineDeps(this.deps, deps),
      this.options
    );
  }

  float(from: number, to: number): number {
    return Math.trunc(this.rand() * (to - from) + from);
  }

  boolean(): boolean {
    return this.select(true, false);
  }

  int(from: number, to: number): number {
    return Math.trunc(this.float(from, to));
  }

  select<const T extends any[]>(...args: T): ArrayItemType<T> {
    return args[this.int(0, args.length)];
  }

  array<T>(from: number, to: number, f: () => T): T[] {
    return Array(this.int(from, to)).fill(0).map(f);
  }

  nested(): GenContext {
    return new GenContext(
      this.rand,
      this.deps,
      this.options,
      this.queryDepth + 1
    );
  }
}

export function gen(
  options?: {seed?: string} & Partial<GenerationOptions>
): Query<any> {
  const ctx = new GenContext(
    seedrandom(options?.seed ?? Math.random().toString()),
    {
      expr: [],
      queries: [staticComments, staticUsers, staticPosts],
    },
    options ?? {}
  );

  return applyFullOrder(genQuery(ctx, undefined));
}

function genQuery(ctx: GenContext, shape: Shape | undefined): Query<any> {
  ctx = ctx.nested();

  const query = ctx.select(
    () => genRootQuery(ctx),
    ...(ctx.queryDepth <= ctx.options.maxDepth
      ? [
          ctx.select(
            () => genProxyQuery(ctx),
            () => genFilterQuery(ctx),
            () => genMapQuery(ctx),
            () => genOrderByQuery(ctx),
            () => genJoinQuery(ctx),
            () => genCombineQuery(ctx),
            () => genUniqueQuery(ctx),
            () =>
              ctx.options.disableGroupBy
                ? genQuery(ctx, shape)
                : genGroupByQuery(ctx), // todo: fix group by projections
            () =>
              ctx.options.disableFlatMap
                ? genQuery(ctx, shape)
                : genFlatMapQuery(ctx),
            () => genPaginationQuery(ctx)
          ),
        ]
      : [])
  )();

  if (!shape) {
    return query;
  }

  const {source, deps} = genQuerySource(ctx, query);
  return new MapQuery(source, genProjection(shape, ctx.with(deps)));
}

function applyFullOrder(query: Query<any>): Query<any> {
  return match(query.projection)
    .with({type: 'scalar'}, () => query.orderByAsc(x => x))
    .with({type: 'object'}, proj =>
      proj.props
        .filter((x): x is SinglePropProjection => x.type === 'single')
        .reduce(
          (q, property) =>
            q.thenByAsc(x =>
              property.path.reduce((handle, part) => handle[part], x)
            ),
          query
        )
    )
    .exhaustive();
}

function genProjection(shape: Shape | undefined, ctx: GenContext): Projection {
  if (shape) {
    return match(shape)
      .with({type: 'scalar'}, x => genScalarProjection(x, ctx))
      .with({type: 'object'}, x => genObjectProjection(x, ctx))
      .exhaustive();
  }

  return ctx.select(
    () => genScalarProjection(undefined, ctx),
    () => genObjectProjection(undefined, ctx)
  )();
}

function genScalarProjection(
  shape: ScalarShape | undefined,
  ctx: GenContext
): ScalarProjection {
  const expr = genExpr(
    shape ? [{type: 'scalar', scalarType: shape.scalarType}] : DYNAMIC_SHAPE,
    ctx
  );
  const exprProj = expr.projection();
  assert(exprProj.type === 'scalar', 'generated expr must be a dynamic scalar');
  return exprProj;
}

function genObjectProjection(
  shape: ObjectShape | undefined,
  ctx: GenContext
): ObjectProjection {
  if (shape) {
    assert(
      shape.props.every(x => x.type === 'single'),
      'can only generate object projection with single prop projections'
    );
    return {
      type: 'object',
      nullable: shape.nullable,
      refs: [],
      props: (shape.props as SinglePropShape[]).map(prop => ({
        type: 'single',
        expr: genExpr([{type: 'scalar', scalarType: prop.scalarType}], ctx),
        path: prop.path,
        scalarType: prop.scalarType,
      })),
    };
  } else {
    return genAnyObjectProjection(ctx);
  }
}

function genAnyObjectProjection(ctx: GenContext): ObjectProjection {
  const props = ctx.array(1, 5, () => {
    const locators = ctx.deps.expr.filter(
      (x): x is LocatorExpr<any> =>
        x instanceof LocatorExpr && x.projection().type === 'object'
    );
    if (locators.length > 0) {
      return ctx.select(
        () => genWildcardPropProjection(locators, ctx),
        () => genSinglePropProjection(ctx)
      )();
    } else {
      return genSinglePropProjection(ctx);
    }
  });
  return {
    type: 'object',
    nullable: false,
    // todo: fill refs from wildcard projections
    refs: [],
    props: props
      .sort((a, b) => {
        if (a.type === 'wildcard') {
          return -1;
        }

        if (b.type === 'wildcard') {
          return 1;
        }

        return a.path.length - b.path.length;
      })
      .filter(
        (outerProp, outerIndex) =>
          outerProp.type === 'wildcard' ||
          props.every(
            (innerProp, innerIndex) =>
              outerIndex >= innerIndex ||
              innerProp.type === 'wildcard' ||
              !startsWith(innerProp.path, outerProp.path)
          )
      ),
  };
}

function genWildcardPropProjection(
  locators: LocatorExpr<any>[],
  ctx: GenContext
): WildcardPropProjection {
  return {
    type: 'wildcard',
    source: ctx.select(...locators),
  };
}

function genSinglePropProjection(ctx: GenContext): SinglePropProjection {
  const exprProj = genExpr(DYNAMIC_SHAPE, ctx).projection();
  assert(
    exprProj.type === 'scalar' && exprProj.scalarType.type !== 'array',
    'gen expr must be a dynamic scalar'
  );
  return {
    type: 'single',
    expr: exprProj.expr,
    scalarType: exprProj.scalarType,
    path: ctx.array(1, 3, () => ctx.int(1, 5).toString()),
  };
}

function genMapQuery(ctx: GenContext): Query<any> {
  const {source, deps} = genQuerySource(ctx);
  return new MapQuery(source, genProjection(undefined, ctx.with(deps)));
}

function genFilterQuery(ctx: GenContext): Query<any> {
  const {source, deps} = genQuerySource(ctx);
  return new FilterQuery(source, genExpr(BOOLEAN_SHAPE, ctx.with(deps)));
}

const DYNAMIC_SHAPE: readonly ScalarShape[] = [
  {type: 'scalar', scalarType: {type: 'dynamic', nullable: true}},
];

const BOOLEAN_SHAPE: readonly ScalarShape[] = [
  {type: 'scalar', scalarType: {type: 'boolean', nullable: true}},
];

function genOrderByQuery(ctx: GenContext): Query<any> {
  const {source, deps} = genQuerySource(ctx);
  const terms: OrderByTermPrivate[] = ctx.array(1, 5, () => ({
    expr: genExpr(DYNAMIC_SHAPE, ctx.with(deps)),
    options: {
      ...ctx.select({asc: true}, {desc: true}),
      nulls: ctx.select(undefined, 'first', 'last'),
    },
  }));
  return new OrderByQuery(source, terms);
}

// todo: validate that group by is valid
function genGroupByQuery(ctx: GenContext): Query<any> {
  const {source, deps} = genQuerySource(ctx);
  const groupByCtx = ctx.with(deps);
  return new GroupByQuery(
    source,
    genProjection(undefined, groupByCtx),
    ctx.array(1, 5, () => genExpr(DYNAMIC_SHAPE, groupByCtx)),
    ctx.select(undefined, genExpr(BOOLEAN_SHAPE, groupByCtx))
  );
}

function genJoinType(ctx: GenContext) {
  return ctx.select('inner', 'left', 'right', 'full');
}

function genJoinQuery(ctx: GenContext): Query<any> {
  const {source: left, deps: leftDeps} = genQuerySource(ctx);
  const {source: right, deps: rightDeps} = genQuerySource(ctx);
  const type = genJoinType(ctx);
  const joinCtx = ctx.with(combineDeps(leftDeps, rightDeps));
  return new JoinQuery(left, {
    projection: genProjection(undefined, joinCtx),
    right,
    type,
    filterExpr: ctx.select(undefined, genExpr(BOOLEAN_SHAPE, joinCtx)),
    lateral: false,
  });
}

function toShape(projection: Projection): Shape {
  return match(projection)
    .with({type: 'scalar'}, x => toScalarShape(x))
    .with({type: 'object'}, x => toObjectShape(x))
    .exhaustive();
}

function toScalarShape(projection: ScalarProjection): ScalarShape {
  return {
    type: 'scalar',
    scalarType: projection.scalarType,
  };
}

function toObjectShape(projection: ObjectProjection): ObjectShape {
  return {
    type: 'object',
    nullable: projection.nullable,
    props: projection.props.map(prop =>
      match(prop)
        .with({type: 'single'}, x => toSinglePropShape(x))
        .with({type: 'wildcard'}, x => toWildcardPropShape(x))
        .exhaustive()
    ),
  };
}

function toSinglePropShape(prop: SinglePropProjection): SinglePropShape {
  return {
    type: 'single',
    path: prop.path,
    scalarType: prop.scalarType,
  };
}

function toWildcardPropShape(prop: WildcardPropProjection): WildcardPropShape {
  const source = toShape(prop.source.projection());
  assert(source.type === 'object', 'invalid wildcard projection from scalar');
  return {
    type: 'wildcard',
    source,
  };
}

function genCombineQuery(ctx: GenContext): Query<any> {
  const source = genQuerySource(ctx).source;
  return new CombineQuery(source, {
    type: ctx.select('concat', 'except', 'intersect', 'union', 'union_all'),
    other: genQuery(ctx, toShape(source.projection)),
  });
}

function genUniqueQuery(ctx: GenContext): Query<any> {
  return new UniqueQuery(genQuerySource(ctx).source);
}

function genFlatMapQuery(ctx: GenContext): Query<any> {
  const {source: left, deps: leftDeps} = genQuerySource(ctx);
  const {source: right, deps: rightDeps} = genQuerySource(ctx.with(leftDeps));
  const joinCtx = ctx.with(leftDeps).with(rightDeps);
  return new JoinQuery(left, {
    projection: genProjection(undefined, joinCtx),
    right,
    type: genJoinType(ctx),
    filterExpr: ctx.select(undefined, genExpr(BOOLEAN_SHAPE, joinCtx)),
    lateral: true,
  });
}

function genProxyQuery(ctx: GenContext): Query<any> {
  return new ProxyQuery(genQuerySource(ctx).source);
}

function genPaginationQuery(ctx: GenContext): Query<any> {
  return new PaginationQuery(
    new QuerySource({
      type: 'query',
      query: applyFullOrder(new ProxyQuery(genQuerySource(ctx).source)),
    }),
    ctx.int(0, 5),
    ctx.select(undefined, ctx.int(0, 5))
  );
}

interface Deps {
  readonly expr: Expr<any>[];
  readonly queries: Query<any>[];
}

function combineDeps(a: Deps, b: Deps): Deps {
  return {
    expr: a.expr.concat(b.expr),
    queries: a.queries.concat(b.queries),
  };
}

function genQuerySource(
  ctx: GenContext,
  sourceQuery?: Query<any>
): {
  source: QuerySource;
  deps: Deps;
} {
  const source = new QuerySource({
    type: 'query',
    query: sourceQuery ?? genQuery(ctx, undefined),
  });
  const {expr, queries} = match(source.projection)
    .with(
      {type: 'scalar'},
      (): Deps => ({expr: [new LocatorExpr(source, [], false)], queries: []})
    )
    .with(
      {type: 'object'},
      (proj): Deps => ({
        // todo: add parent ref exprs
        expr: proj.props.map(prop =>
          match(prop)
            .with(
              {type: 'single'},
              x => new LocatorExpr(source, [x.path], false)
            )
            .with({type: 'wildcard'}, x => x.source)
            .exhaustive()
        ),
        queries: proj.refs
          .filter((x): x is ChildrenRef => x.type === 'children')
          .map(x =>
            x.child().filter(child => x.condition(createHandle(source), child))
          ),
      })
    )
    .exhaustive();
  return {
    source,
    deps: {
      expr: [...expr],
      queries: [...queries, ...extractQueries(source)],
    },
  };
}

function genRootQuery(ctx: GenContext): Query<any> {
  return ctx.select(
    ctx.select(staticComments, staticPosts),
    ctx.select(...ctx.deps.queries)
  );
}

function matchProjection(proj: Projection, shape: Shape): boolean {
  return match(proj)
    .with({type: 'scalar'}, x =>
      shape.type === x.type ? matchScalarProjection(x, shape) : false
    )
    .with({type: 'object'}, x =>
      shape.type === x.type ? matchObjectProjection(x, shape) : false
    )
    .exhaustive();
}

// todo: handle promotion and dynamic
function matchScalarType(actual: ScalarType, expected: ScalarType): boolean {
  if (actual.nullable && !expected.nullable) {
    return false;
  }
  actual = {...actual, nullable: expected.nullable};
  if (expected.type === 'dynamic') {
    return true;
  }

  if (expected.nullable && actual.type === 'null') {
    return true;
  }

  if (isInt(expected) && isInt(actual)) {
    return true;
  }

  if (isFloat(expected) && isFloat(actual)) {
    return true;
  }

  if (isChar(expected) && isChar(actual)) {
    return true;
  }

  return deepEqual(actual, expected);
}

function matchScalarProjection(
  proj: ScalarProjection,
  shape: ScalarShape
): boolean {
  return matchScalarType(proj.scalarType, shape.scalarType);
}

function matchNullable(proj: boolean, shape: boolean) {
  return shape || !proj;
}

function matchObjectProjection(
  proj: ObjectProjection,
  shape: ObjectShape
): boolean {
  // todo: allow proj to have more props
  if (
    !matchNullable(proj.nullable, shape.nullable) ||
    proj.props.length !== shape.props.length
  ) {
    return false;
  }

  for (let i = 0; i < proj.props.length; i += 1) {
    if (!matchProp(proj.props[i], shape.props[i])) {
      return false;
    }
  }

  return true;
}

function matchProp(proj: PropProjection, shape: PropShape): boolean {
  return match(proj)
    .with(
      {type: 'single'},
      x => shape.type === x.type && matchSingleProp(x, shape)
    )
    .with(
      {type: 'wildcard'},
      x => shape.type === x.type && matchWildcardProp(x, shape)
    )
    .exhaustive();
}

function matchSingleProp(
  proj: SinglePropProjection,
  shape: SinglePropShape
): boolean {
  return (
    matchScalarType(proj.scalarType, shape.scalarType) &&
    deepEqual(proj.path, shape.path)
  );
}

function matchWildcardProp(
  proj: WildcardPropProjection,
  shape: WildcardPropShape
): boolean {
  return matchProjection(proj.source.projection(), shape.source);
}

const INT_SHAPES: ScalarShape[] = (
  ['i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64'] as const
).map(type => ({type: 'scalar', scalarType: {type, nullable: true}}));

const NUMERIC_SHAPES: ScalarShape[] = INT_SHAPES.concat(
  (['f32', 'f64'] as const).map(type => ({
    type: 'scalar',
    scalarType: {type, nullable: true},
  }))
);

function genExpr<T extends SingleLiteralValue>(
  shapes: readonly ScalarShape[],
  ctx: GenContext
): Expr<T> {
  const expressions: {
    [K in keyof typeof Expr as K extends 'prototype' | 'toString' | 'from'
      ? never
      : string]: () => Expr<any>;
  } = {
    // average: () => Expr.average(genExpr(NUMERIC_SHAPES, ctx)),
    // avg: () => Expr.avg(genExpr(NUMERIC_SHAPES, ctx)),
    // count: () => Expr.count(genExpr(NUMERIC_SHAPES, ctx)),
    // sum: () => Expr.sum(genExpr(NUMERIC_SHAPES, ctx)),
    // min: () => Expr.min(genExpr(NUMERIC_SHAPES, ctx)),
    // max: () => Expr.max(genExpr(NUMERIC_SHAPES, ctx)),

    plus: () => Expr.plus(genExpr(NUMERIC_SHAPES, ctx)),
    minus: () => Expr.minus(genExpr(NUMERIC_SHAPES, ctx)),
    add: () =>
      Expr.add(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    div: () =>
      Expr.div(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    divide: () =>
      Expr.divide(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    mod: () =>
      Expr.mod(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    modulus: () =>
      Expr.modulus(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    sub: () =>
      Expr.add(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    subtract: () =>
      Expr.subtract(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    mul: () =>
      Expr.mul(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    multiply: () =>
      Expr.multiply(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    eq: () =>
      Expr.eq(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    not: () => Expr.not(genExpr(BOOLEAN_SHAPE, ctx)),
    and: () =>
      Expr.and(genExpr(BOOLEAN_SHAPE, ctx), genExpr(BOOLEAN_SHAPE, ctx)),
    or: () => Expr.or(genExpr(BOOLEAN_SHAPE, ctx), genExpr(BOOLEAN_SHAPE, ctx)),
    bitwiseAnd: () =>
      Expr.bitwiseAnd(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    bitwiseOr: () =>
      Expr.bitwiseOr(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    bitwiseXor: () =>
      Expr.bitwiseXor(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    shiftLeft: () =>
      Expr.shiftLeft(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    shiftRight: () =>
      Expr.shiftRight(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    shl: () => Expr.shl(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    shr: () => Expr.shr(genExpr(INT_SHAPES, ctx), genExpr(INT_SHAPES, ctx)),
    bitwiseNot: () => Expr.bitwiseNot(genExpr(INT_SHAPES, ctx)),

    equals: () =>
      Expr.equals(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    ne: () =>
      Expr.ne(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    notEquals: () =>
      Expr.notEquals(
        genExpr(NUMERIC_SHAPES, ctx),
        genExpr(NUMERIC_SHAPES, ctx)
      ),
    gt: () =>
      Expr.gt(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    greaterThan: () =>
      Expr.greaterThan(
        genExpr(NUMERIC_SHAPES, ctx),
        genExpr(NUMERIC_SHAPES, ctx)
      ),
    gte: () =>
      Expr.gte(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    greaterThanOrEqualTo: () =>
      Expr.greaterThanOrEqualTo(
        genExpr(NUMERIC_SHAPES, ctx),
        genExpr(NUMERIC_SHAPES, ctx)
      ),
    lt: () =>
      Expr.lt(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    lessThan: () =>
      Expr.lessThan(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    lte: () =>
      Expr.lte(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    lessThanOrEqualTo: () =>
      Expr.lessThanOrEqualTo(
        genExpr(NUMERIC_SHAPES, ctx),
        genExpr(NUMERIC_SHAPES, ctx)
      ),
    le: () =>
      Expr.le(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
    ge: () =>
      Expr.ge(genExpr(NUMERIC_SHAPES, ctx), genExpr(NUMERIC_SHAPES, ctx)),
  };

  const singleScalarTypes = shapes
    .map(x => x.scalarType)
    .filter((x): x is SingleScalarType => x.type !== 'array');

  const selectExpr = () => {
    if (singleScalarTypes.length > 0 && ctx.boolean()) {
      return genSingleLiteralExpr(ctx.select(...singleScalarTypes), ctx);
    }
    return ctx.select(
      () => ctx.select(...ctx.deps.expr),
      ctx.select(...Object.values(expressions))
    )();
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const expr = selectExpr();

    if (
      shapes.some(shape =>
        matchProjection((expr as Expr<any>).projection(), shape)
      )
    ) {
      return expr as Expr<T>;
    }
  }
}

function genSingleLiteralExpr(
  scalarType: SingleScalarType,
  ctx: GenContext
): Expr<SingleLiteralValue> {
  if (scalarType.nullable && ctx.int(0, 10) === 0) {
    return Expr.from(null);
  }

  type Generator = () => Expr<SingleLiteralValue>;
  const generators: Generator[] = [];
  function push(g: Generator) {
    generators.push(g);
  }

  const dynamic = scalarType.type === 'dynamic';

  if (scalarType.type === 'boolean' || dynamic) {
    push(() => Expr.from(ctx.select(true, false)));
  }
  if (scalarType.type === 'char' || dynamic) {
    const n = scalarType.type === 'char' ? scalarType.n : ctx.int(0, 5);
    push(
      () =>
        new LiteralExpr({
          type: {type: 'char', n, nullable: false},
          value: ctx.array(n, n + 1, () => ctx.int(0, 10).toString()).join(''),
        })
    );
  }
  if (scalarType.type === 'date' || dynamic) {
    push(() => Expr.from(new Date(1720125454861 + ctx.int(-10, +10))));
  }
  if (scalarType.type === 'f32' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'f32', nullable: false},
          value: ctx.float(-5, 5),
        })
    );
  }
  if (scalarType.type === 'f64' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'f64', nullable: false},
          value: ctx.float(-5, 5),
        })
    );
  }
  if (scalarType.type === 'i16' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'i16', nullable: false},
          value: ctx.int(-5, 5),
        })
    );
  }
  if (scalarType.type === 'i32' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'i32', nullable: false},
          value: ctx.int(-5, 5),
        })
    );
  }
  if (scalarType.type === 'i64' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'i64', nullable: false},
          value: ctx.int(-5, 5),
        })
    );
  }
  if (scalarType.type === 'i8' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'i8', nullable: false},
          value: ctx.int(-5, 5),
        })
    );
  }
  if (scalarType.type === 'null' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'null', nullable: true},
          value: null,
        })
    );
  }
  if (scalarType.type === 'time' || dynamic) {
    //
  }
  if (scalarType.type === 'timestamp' || dynamic) {
    //
  }
  if (scalarType.type === 'timestamptz' || dynamic) {
    //
  }
  if (scalarType.type === 'timetz' || dynamic) {
    //
  }
  if (scalarType.type === 'u16' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'u16', nullable: false},
          value: ctx.int(0, 5),
        })
    );
  }
  if (scalarType.type === 'u32' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'u32', nullable: false},
          value: ctx.int(0, 5),
        })
    );
  }
  if (scalarType.type === 'u64' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'u64', nullable: false},
          value: ctx.int(0, 5),
        })
    );
  }
  if (scalarType.type === 'u8' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'u8', nullable: false},
          value: ctx.int(0, 5),
        })
    );
  }
  if (scalarType.type === 'uuid' || dynamic) {
    push(
      () =>
        new LiteralExpr({
          type: {type: 'uuid', nullable: false},
          value: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
            .split('')
            .map(x => (x === 'X' ? ctx.int(0, 10) : x))
            .join(''),
        })
    );
  }
  if (scalarType.type === 'varchar' || dynamic) {
    push(() =>
      Expr.from(ctx.array(1, 5, () => ctx.int(0, 5).toString()).join(''))
    );
  }
  return ctx.select(...generators)();
}
