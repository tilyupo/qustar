import {match} from 'ts-pattern';
import {Connector, materialize, SqlCommand} from '../connector.js';
import {EntityDescriptor, Table, toInternalSchema} from '../descriptor.js';
import {SingleLiteralValue} from '../literal.js';
import {renderPostgreSql} from '../render/postgresql.js';
import {renderSqlite} from '../render/sqlite.js';
import {optimize} from '../sql/optimizer.js';
import {
  ConvertMappingToValue,
  ConvertScalarMappingToScalarValue,
  Expand,
  FilterFn,
  JoinFilterFn,
  JoinMapFn,
  Mapping,
  MapQueryFn,
  MapScalarArrayFn,
  MapScalarFn,
  MapValueFn,
  QueryValue,
  ScalarMapping,
  Value,
} from '../types/query.js';
import {
  DeriveEntity,
  DeriveEntityDescriptor,
  ValidateEntity,
} from '../types/schema.js';
import {
  arrayEqual,
  assert,
  assertNever,
  deduplicateFirstWins,
  startsWith,
} from '../utils.js';
import {CompilationOptions, compileQuery} from './compiler.js';
import {
  Expr,
  LocatorExpr,
  Nullable,
  QueryTerminatorExpr,
  ScalarOperand,
} from './expr.js';
import {
  ObjectProjection,
  Projection,
  PropPath,
  PropProjection,
  ScalarProjection,
} from './projection.js';
import {ChildrenRef, ParentRef, Ref, Schema, SqlTemplate} from './schema.js';

export type JoinType = 'inner' | 'left' | 'right';

export interface JoinOptionsPublic<
  Left extends Value<Left>,
  Right extends Value<Right>,
  Result extends Mapping,
> {
  readonly type: JoinType;
  readonly right: Query<Right>;
  readonly condition?: JoinFilterFn<Left, Right>;
  readonly select: JoinMapFn<Left, Right, Result>;
}

export interface JoinOptionsPrivate {
  readonly type: JoinType;
  readonly right: QuerySource;
  readonly filterExpr?: Expr<boolean | null>;
  readonly projection: Projection;
  readonly lateral?: boolean;
}

export type OrderByType = 'desc' | 'asc';

export type OrderByOptions =
  | {asc: true; desc?: undefined}
  | {desc: true; asc?: undefined};

export type CombinationType =
  | 'union'
  | 'union_all'
  | 'intersect'
  | 'except'
  | 'concat';

export interface CombineOptions<T> {
  readonly type: CombinationType;
  readonly other: Query<T>;
}

function schemaProjection(root: QuerySource, schema: Schema): Projection {
  return {
    type: 'object',
    props: schema.fields.map(
      (x): PropProjection => ({
        path: [x.name],
        scalarType: x.scalarType,
        expr: new LocatorExpr(root, [[x.name]], false),
      })
    ),
    refs: schema.refs,
    nullable: false,
  };
}

export class QuerySource {
  public readonly projection: Projection;

  constructor(
    public readonly inner:
      | {readonly type: 'table'; readonly name: string; readonly schema: Schema}
      | {
          readonly type: 'query';
          readonly query: Query<any>;
        }
      | {
          readonly type: 'sql';
          readonly sql: SqlTemplate;
          readonly schema: Schema;
        }
  ) {
    this.projection = match(this.inner)
      .with({type: 'table'}, ({schema}) => schemaProjection(this, schema))
      .with({type: 'query'}, ({query}) => query.projection)
      .with({type: 'sql'}, ({schema}) => schemaProjection(this, schema))
      .exhaustive();
  }
}

export interface QueryVisitor<T> {
  proxy(q: ProxyQuery<any>): T;
  filter(q: FilterQuery<any>): T;
  map(q: MapQuery<any>): T;
  orderBy(q: OrderByQuery<any>): T;
  groupBy(q: GroupByQuery<any>): T;
  join(q: JoinQuery<any>): T;
  combine(q: CombineQuery<any>): T;
  unique(q: UniqueQuery<any>): T;
  pagination(q: PaginationQuery<any>): T;
  flatMap(q: FlatMapQuery<any>): T;
}

interface GroupByOptions<T extends Value<T>, Result extends Mapping> {
  readonly by: MapScalarArrayFn<T, ScalarMapping[] | ScalarMapping>;
  readonly select: MapValueFn<T, Result>;
  readonly having?: FilterFn<T>;
}

export type RenderOptions = CompilationOptions & {readonly optimize?: boolean};

export namespace Query {
  export type infer<T extends Query<any>> = QueryValue<T>;
  export type schema<T extends ValidateEntity<T>> = DeriveEntityDescriptor<T>;
}

export abstract class Query<T extends Value<T>> {
  static table<const TSchema extends EntityDescriptor>(
    descriptor: Table<TSchema>
  ): Query<DeriveEntity<TSchema>> {
    const schema: (table: () => Query<any>) => Schema = table =>
      toInternalSchema(table, descriptor.schema);
    const table = new ProxyQuery<DeriveEntity<TSchema>>(
      new QuerySource({
        type: 'table',
        name: descriptor.name,
        schema: schema(() => table),
      })
    );
    return table;
  }

  static raw<T extends Value<T> = any>(options: {
    sql: SqlTemplate;
    schema: EntityDescriptor;
  }): Query<T> {
    const query = new ProxyQuery(
      new QuerySource({
        type: 'sql',
        sql: options.sql,
        schema: toInternalSchema(() => query, options.schema),
      })
    );
    return query;
  }

  constructor(
    public readonly source: QuerySource,
    public readonly projection: Projection
  ) {}

  abstract visit<T>(visitor: QueryVisitor<T>): T;

  pipe(): (input: Query<T>) => Query<T>;
  pipe<R>(fn1: (arg: Query<T>) => R): (arg: Query<T>) => R;
  pipe<A, R>(fn1: (arg: Query<T>) => A, fn2: (arg: A) => R): R;
  pipe<A, B, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => R
  ): R;
  pipe<A, B, C, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: C) => R
  ): R;
  pipe<A, B, C, D, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => R
  ): R;
  pipe<A, B, C, D, E, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => R
  ): R;
  pipe<A, B, C, D, E, F, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => F,
    fn7: (arg: F) => R
  ): R;
  pipe<A, B, C, D, E, F, G, R>(
    fn1: (arg: Query<T>) => A,
    fn2: (arg: A) => B,
    fn3: (arg: B) => C,
    fn4: (arg: B) => D,
    fn5: (arg: D) => E,
    fn6: (arg: E) => F,
    fn7: (arg: F) => G,
    fn8: (arg: G) => R
  ): R;
  pipe(...fns: Function[]) {
    if (fns.length === 0) {
      return (input: Query<T>) => input;
    }
    if (fns.length === 1) {
      return fns[0];
    }
    return fns.reverse().reduce(
      (prevFn, nextFn) =>
        (...args: any[]) =>
          prevFn(nextFn(...args))
    )(this);
  }

  render(
    dialect: 'sqlite' | 'postgresql',
    options?: RenderOptions
  ): SqlCommand {
    return this.pipe(
      x => compileQuery(x, options),
      x => ((options?.optimize ?? true) ? optimize(x) : x),
      match(dialect)
        .with('sqlite', () => renderSqlite)
        .with('postgresql', () => renderPostgreSql)
        .exhaustive()
    );
  }

  renderInline(
    dialect: 'sqlite' | 'postgresql',
    options?: RenderOptions
  ): string {
    return this.render(dialect, {...options, parameters: false}).src;
  }

  async execute(connector: Connector): Promise<T[]> {
    const command = connector.render(this.pipe(compileQuery, optimize));
    const rows = await connector.select(command);

    return rows.map(row => materialize(row, this.projection));
  }

  // modificators

  groupBy<Result extends Mapping>({
    by,
    select,
    having,
  }: GroupByOptions<T, Result>): Query<Expand<ConvertMappingToValue<Result>>> {
    const nextSource = new QuerySource({type: 'query', query: this});
    const handle = createHandle(nextSource);

    const projection = inferProjection(select(handle));
    const havingExpr = having ? Expr.from(having(handle)) : undefined;
    let groupingExpr = by(handle);
    if (!Array.isArray(groupingExpr)) {
      groupingExpr = [groupingExpr];
    }

    return new GroupByQuery(
      nextSource,
      projection,
      groupingExpr.map(Expr.from),
      havingExpr
    );
  }

  filter(filter: FilterFn<T>): Query<T> {
    return FilterQuery.create(this, filter);
  }

  where(filter: FilterFn<T>): Query<T> {
    return this.filter(filter);
  }

  map<Result extends Mapping>(
    selector: MapValueFn<T, Result>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    const nextSource = new QuerySource({type: 'query', query: this});
    const handle = createHandle(nextSource);
    const result = selector(handle);

    const mapping = inferProjection(result);
    return new MapQuery(nextSource, mapping);
  }

  select<TMapping extends Mapping>(
    selector: MapValueFn<T, TMapping>
  ): Query<Expand<ConvertMappingToValue<TMapping>>> {
    return this.map(selector);
  }

  orderByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(
      new QuerySource({type: 'query', query: this}),
      [],
      {selector, options: {asc: true}}
    );
  }

  orderByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(
      new QuerySource({type: 'query', query: this}),
      [],
      {selector, options: {desc: true}}
    );
  }

  thenByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return this.orderByAsc(selector);
  }

  thenByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return this.orderByDesc(selector);
  }

  sortByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): Query<T> {
    return this.orderByDesc(selector);
  }

  sortByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): Query<T> {
    return this.orderByAsc(selector);
  }

  join<Right extends Value<Right>, Result extends Mapping>(
    options: JoinOptionsPublic<T, Right, Result>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    const left = new QuerySource({type: 'query', query: this});
    const right = new QuerySource({
      type: 'query',
      query: options.right,
    });

    const leftProjHandle = createHandle(left, options.type === 'right');
    const rightProjHandle = createHandle(right, options.type === 'left');

    return new JoinQuery(left, {
      projection: inferProjection(
        options.select(leftProjHandle, rightProjHandle)
      ),
      right: right,
      type: options.type,
      filterExpr: options.condition
        ? Expr.from(options.condition(createHandle(left), createHandle(right)))
        : undefined,
      lateral: false,
    });
  }

  leftJoin<Right extends Value<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'left',
    });
  }

  innerJoin<Right extends Value<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'inner',
    });
  }

  rightJoin<Right extends Value<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'right',
    });
  }

  flatMap<Result = any>(selector: MapQueryFn<T, Result>): Query<Result> {
    const nextSource: QuerySource = new QuerySource({
      type: 'query',
      query: this,
    });
    const leftHandle = createHandle(nextSource);
    const target = selector(leftHandle);

    if (!(target instanceof Query)) {
      throw new Error('flatMap can only map to nested query');
    }

    const right = new QuerySource({type: 'query', query: target});
    const rightHandle = createHandle(right);

    return new FlatMapQuery(nextSource, {
      type: 'inner',
      right: right,
      projection: inferProjection(rightHandle),
      lateral: true,
    });
  }

  selectMany<Result = any>(selector: MapQueryFn<T, Result>): Query<Result> {
    return this.flatMap(selector);
  }

  private combine(options: CombineOptions<T>): Query<T> {
    return new CombineQuery(
      new QuerySource({type: 'query', query: this}),
      options
    );
  }

  union(query: Query<T>): Query<T> {
    return this.combine({
      type: 'union',
      other: query,
    });
  }

  unionAll(query: Query<T>): Query<T> {
    return this.combine({
      type: 'union_all',
      other: query,
    });
  }

  intersect(query: Query<T>): Query<T> {
    return this.combine({
      type: 'intersect',
      other: query,
    });
  }

  except(query: Query<T>): Query<T> {
    return this.combine({
      type: 'except',
      other: query,
    });
  }

  concat(query: Query<T>): Query<T> {
    return this.combine({
      type: 'concat',
      other: query,
    });
  }

  unique(): Query<T> {
    return new UniqueQuery(new QuerySource({type: 'query', query: this}));
  }

  distinct(): Query<T> {
    return this.unique();
  }

  uniq(): Query<T> {
    return this.unique();
  }

  limit(limit: number, offset?: number): Query<T> {
    return new PaginationQuery(
      new QuerySource({type: 'query', query: this}),
      limit,
      offset
    );
  }

  slice(start: number, end?: number): Query<T> {
    if (end !== undefined) {
      return this.limit(end - start, start);
    } else {
      return this.skip(start);
    }
  }

  take(count: number): Query<T> {
    return this.limit(count);
  }

  skip(offset: number): Query<T> {
    // SQL doesn't allow to use OFFSET without LIMIT
    return new PaginationQuery(
      new QuerySource({type: 'query', query: this}),
      1_000_000_000_000_000,
      offset
    );
  }

  drop(count: number): Query<T> {
    return this.skip(count);
  }

  // terminators

  max<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return new QueryTerminatorExpr('max', this.map(selector));
  }

  min<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return new QueryTerminatorExpr('min', this.map(selector));
  }

  mean<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return new QueryTerminatorExpr('mean', this.map(selector));
  }

  avg<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return this.mean(selector);
  }

  average<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return this.mean(selector);
  }

  sum<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return new QueryTerminatorExpr('sum', this.map(selector));
  }

  first<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<ConvertScalarMappingToScalarValue<Scalar>>> {
    return new QueryTerminatorExpr('first', this.map(selector));
  }

  contains<R extends Nullable<T>>(
    value: ScalarOperand<R & SingleLiteralValue>
  ): QueryTerminatorExpr<boolean> {
    return new QueryTerminatorExpr(
      'some',
      this.filter(x => (x as any).eq(Expr.from(value)))
    );
  }

  some(): QueryTerminatorExpr<boolean> {
    return new QueryTerminatorExpr('some', this);
  }

  any(): QueryTerminatorExpr<boolean> {
    return this.some();
  }

  empty(): QueryTerminatorExpr<boolean> {
    return new QueryTerminatorExpr('empty', this);
  }

  size(): QueryTerminatorExpr<number> {
    return new QueryTerminatorExpr('size', this);
  }

  count(): QueryTerminatorExpr<number> {
    return this.size();
  }

  length(): QueryTerminatorExpr<number> {
    return this.size();
  }
}

function proxyProjection(source: QuerySource): Projection {
  return match(source.projection)
    .with({type: 'object'}, x => proxyObjectProjection(source, x))
    .with({type: 'scalar'}, x => proxyScalarProjection(source, x))
    .exhaustive();
}

function proxyScalarProjection(
  source: QuerySource,
  sourceProj: ScalarProjection
): ScalarProjection {
  return {
    type: 'scalar',
    scalarType: sourceProj.scalarType,
    expr: new LocatorExpr(source, [], false),
  };
}

function proxyObjectProjection(
  source: QuerySource,
  sourceProj: ObjectProjection
): ObjectProjection {
  return {
    type: 'object',
    props: sourceProj.props.map(prop => ({
      type: 'single',
      expr: new LocatorExpr(source, [prop.path], false),
      path: prop.path,
      scalarType: prop.scalarType,
    })),
    refs: sourceProj.refs,
    nullable: sourceProj.nullable,
  };
}

export class FilterQuery<T extends Value<T>> extends Query<T> {
  static create<T extends Value<T>>(
    query: Query<T>,
    filter: FilterFn<T>
  ): Query<T> {
    const source = new QuerySource({type: 'query', query});
    const handle = createHandle(source);
    const filterExpr = Expr.from(filter(handle));

    return new FilterQuery(source, filterExpr);
  }

  constructor(
    source: QuerySource,
    public readonly filterExpr: Expr<boolean | null>
  ) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.filter(this);
  }
}

export function createHandle(
  root: QuerySource | LocatorExpr<any>,
  optional = false
): any {
  const locator =
    root instanceof LocatorExpr ? root : new LocatorExpr(root, [], optional);
  const proj = locator.projection();
  if (proj.type === 'object') {
    return createObjectHandle(locator, proj, []);
  } else if (proj.type === 'scalar') {
    return locator;
  }

  return assertNever(proj, 'unknown query projection type');
}

const SPREAD_PLACEHOLDER_PREFIX = '__orm_private_spread_placeholder_';
let magicCounter = 0;
function createSpreadPlaceholder() {
  magicCounter += 1;
  return `${SPREAD_PLACEHOLDER_PREFIX}${magicCounter}`;
}

function createObjectHandle(
  locator: LocatorExpr<any>,
  proj: ObjectProjection,
  prefix: PropPath
): any {
  const spreadPlaceholder = createSpreadPlaceholder();
  return new Proxy(
    {[spreadPlaceholder]: locator},
    {
      get(_, prop) {
        if (typeof prop === 'symbol') {
          throw new Error('can not use symbol as handle property');
        }

        if (prop === spreadPlaceholder) {
          return locator;
        }

        for (const ref of proj.refs) {
          if (arrayEqual(ref.path, [...prefix, prop])) {
            return createRefHandle(locator, ref);
          }
        }

        for (const path of [
          ...proj.refs.map(x => x.path),
          ...proj.props.map(x => x.path),
        ]) {
          if (startsWith(path.slice(0, -1), [...prefix, prop])) {
            return createObjectHandle(locator, proj, [...prefix, prop]);
          }
        }

        // todo: throw if no prop with that name
        return createPropHandle(locator, [...prefix, prop]);
      },
    }
  );
}

function createPropHandle(locator: LocatorExpr<any>, path: PropPath): any {
  return locator.push(path);
}

function createRefHandle(locator: LocatorExpr<any>, ref: Ref): any {
  if (ref.type === 'parent') {
    return createParentRefHandle(locator, ref);
  } else if (ref.type === 'children') {
    return createChildrenRefHandle(locator, ref);
  }

  return assertNever(ref, 'unknown ref type');
}

export function createChildrenRefHandle(
  parent: LocatorExpr<any>,
  ref: ChildrenRef
) {
  return FilterQuery.create(ref.child(), child =>
    ref.condition(createHandle(parent), child)
  );
}

function createParentRefHandle(locator: LocatorExpr<any>, ref: ParentRef): any {
  return createHandle(locator.push(ref.path));
}

function inferProjection(value: Mapping, depth = 0): Projection {
  if (typeof value === 'bigint') {
    throw new Error('bigint selection is not supported');
  } else if (typeof value === 'function') {
    throw new Error('function selection is not supported');
  } else if (typeof value === 'symbol') {
    throw new Error('symbol selection is not supported');
  } else if (typeof value === 'undefined') {
    throw new Error('undefined selection is not supported');
  } else if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return Expr.from(value).projection();
  } else if (typeof value === 'object') {
    if (value === null || value instanceof Expr) {
      return Expr.from(value).projection();
    }

    if (value instanceof Query) {
      throw new Error('query selection is not supported');
    }

    // no more options, it must be a nested object projection

    if (depth > 1024) {
      throw new Error('nested projection is too deep');
    }

    const props: PropProjection[] = [];
    const refs: Ref[] = [];

    // reverse because in SQL first column wins, in JS using spread operator last wins
    const keys = Object.keys(value).reverse();
    for (const key of keys) {
      const propValue = (value as any)[key];
      if (key.startsWith(SPREAD_PLACEHOLDER_PREFIX)) {
        const locator: LocatorExpr<any> = propValue;
        const locatorProj = locator.projection();
        assert(
          locatorProj.type !== 'scalar',
          'invalid wildcard projection for scalar'
        );
        for (const prop of locatorProj.props) {
          props.push({
            expr: locator.push(prop.path),
            path: prop.path,
            scalarType: prop.scalarType,
          });
        }

        refs.push(...locatorProj.refs);
      } else {
        if (propValue === undefined) continue;

        const propProj = inferProjection(propValue, depth + 1);

        if (propProj.type === 'object') {
          for (const nestedProp of propProj.props) {
            props.push({
              path: [key, ...nestedProp.path],
              expr: nestedProp.expr,
              scalarType: nestedProp.scalarType,
            });
          }

          for (const nestedRef of propProj.refs) {
            refs.push({
              ...nestedRef,
              path: [key, ...nestedRef.path],
              condition: (parent, child) =>
                nestedRef.condition(
                  parent,
                  new Proxy(child, {
                    get: (_, prop) => child[key][prop],
                  })
                ),
            });
          }
        } else {
          assert(
            propProj.scalarType.type !== 'array',
            'cannot project to an array type'
          );

          props.push({
            path: [key],
            scalarType: propProj.scalarType,
            expr: propProj.expr,
          });
        }
      }
    }

    return {
      type: 'object',
      props: deduplicateFirstWins(props, (a, b) => arrayEqual(a.path, b.path)),
      refs: deduplicateFirstWins(refs, (a, b) => arrayEqual(a.path, b.path)),
      nullable: false,
    };
  }

  return assertNever(value, 'unsupported selection');
}

export class MapQuery<T extends Value<T>> extends Query<T> {
  constructor(source: QuerySource, projection: Projection) {
    super(source, projection);
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.map(this);
  }
}

export interface OrderByTermPrivate {
  readonly expr: Expr<SingleLiteralValue>;
  readonly options: OrderByOptions;
}

export interface OrderByTermPublic<
  T extends Value<T>,
  Scalar extends ScalarMapping,
> {
  readonly selector: MapScalarFn<T, Scalar>;
  readonly options: OrderByOptions;
}

export class OrderByQuery<T extends Value<T>> extends Query<T> {
  static create<T extends Value<T>, Scalar extends ScalarMapping>(
    source: QuerySource,
    initialTerms: readonly OrderByTermPrivate[],
    term: OrderByTermPublic<T, Scalar>
  ): OrderByQuery<T> {
    const handle = createHandle(source);
    const expr = term.selector(handle);

    const terms: OrderByTermPrivate[] = [...initialTerms];
    if (expr instanceof Expr) {
      terms.push({options: term.options, expr});
    } else if (typeof expr !== 'object') {
      terms.push({options: term.options, expr: Expr.from(expr)});
    } else {
      throw new Error('bad order by');
    }

    return new OrderByQuery(source, terms);
  }

  constructor(
    source: QuerySource,
    public readonly terms: OrderByTermPrivate[]
  ) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.orderBy(this);
  }

  thenByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(this.source, this.terms, {
      selector,
      options: {asc: true},
    });
  }

  thenByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(this.source, this.terms, {
      selector,
      options: {desc: true},
    });
  }
}

export class JoinQuery<T extends Value<T>> extends Query<T> {
  constructor(
    source: QuerySource,
    public readonly options: JoinOptionsPrivate
  ) {
    super(source, options.projection);
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.join(this);
  }
}

export class FlatMapQuery<T extends Value<T>> extends JoinQuery<T> {
  constructor(
    source: QuerySource,
    public readonly options: JoinOptionsPrivate
  ) {
    super(source, options);
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.flatMap(this);
  }
}

export class CombineQuery<T extends Value<T>> extends Query<T> {
  constructor(
    source: QuerySource,
    public readonly options: CombineOptions<T>
  ) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.combine(this);
  }
}

// note: doesn't preserve ordering
export class UniqueQuery<T extends Value<T>> extends Query<T> {
  constructor(source: QuerySource) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.unique(this);
  }
}

export class PaginationQuery<T extends Value<T>> extends Query<T> {
  constructor(
    source: QuerySource,
    public readonly limit_: number,
    public readonly offset_?: number
  ) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.pagination(this);
  }
}

export class ProxyQuery<T extends Value<T>> extends Query<T> {
  constructor(source: QuerySource) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.proxy(this);
  }
}

export class GroupByQuery<T extends Value<T>> extends Query<T> {
  constructor(
    source: QuerySource,
    projection: Projection,
    public readonly by: Expr<any>[],
    public readonly having: Expr<boolean | null> | undefined
  ) {
    super(source, projection);
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.groupBy(this);
  }
}
