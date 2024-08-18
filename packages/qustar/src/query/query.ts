import {match} from 'ts-pattern';
import {Connector, materialize, SqlCommand} from '../connector.js';
import {EntityDescriptor, Table, toSchema} from '../descriptor.js';
import {SingleLiteralValue} from '../literal.js';
import {renderMysql} from '../render/mysql.js';
import {renderPostgresql} from '../render/postgresql.js';
import {renderSqlite} from '../render/sqlite.js';
import {optimize} from '../sql/optimizer.js';
import {Handle, NumericMapping} from '../types/query';
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
  ValidValue,
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
import {CompilationOptions, compileQuery, compileStmt} from './compiler.js';
import {
  Expr,
  LocatorExpr,
  Nullable,
  QueryTerminatorExpr,
  SingleScalarOperand,
} from './expr.js';
import {
  ObjectProjection,
  Projection,
  PropPath,
  PropProjection,
  ScalarProjection,
} from './projection.js';
import {ChildrenRef, ParentRef, Ref, Schema, SqlTemplate} from './schema.js';

export type Dialect = 'sqlite' | 'postgresql' | 'mysql';
export type JoinType = 'inner' | 'left' | 'right';

export interface JoinOptionsPublic<
  Left extends ValidValue<Left>,
  Right extends ValidValue<Right>,
  Result extends Mapping,
> {
  readonly type: JoinType;
  readonly right: Query<Right>;
  readonly condition: JoinFilterFn<Left, Right>;
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

interface GroupByOptions<T extends ValidValue<T>, Result extends Mapping> {
  readonly by: MapScalarArrayFn<T, ScalarMapping[] | ScalarMapping>;
  readonly select: MapValueFn<T, Result>;
  readonly having?: FilterFn<T>;
}

export type RenderOptions = CompilationOptions & {readonly optimize?: boolean};

export namespace Query {
  export type infer<T extends Query<any>> = QueryValue<T>;
  export type schema<T extends ValidateEntity<T>> = DeriveEntityDescriptor<T>;
}

export abstract class Query<T extends ValidValue<T>> {
  /**
   * Describes SQL table name and schema.
   * @param table table name and schema
   * @returns query that selects all columns form the table described in schema.
   * @example
   *  Query.table({
   *    name: 'users',
   *    schema: {
   *      id: 'i32',
   *      name: {type: 'text', nullable: true},
   *    }
   *  })
   */
  static table<const TSchema extends EntityDescriptor>(
    table: Table<TSchema>
  ): TableQuery<TSchema> {
    return new TableQuery<TSchema>(table);
  }

  /**
   * Describes raw SQL with schema.
   * @param options SQL and schema required to run raw sql
   * @returns query that selects all columns from the raw SQL described in schema
   * @example
   *  // parametrized query
   *  import {sql} from 'qustar';
   *  Query.raw({
   *    sql: sql`SELECT id FROM users WHERE id = ${42}`,
   *    schema: {
   *      id: 'i32',
   *    }
   *  })
   *
   * @example
   *  // plain string for SQL
   *  Query.raw({
   *    sql: 'SELECT id FROM users WHERE id = 42',
   *    schema: {
   *      id: 'i32',
   *    }
   *  })
   */
  static raw<const TSchema extends EntityDescriptor>(options: {
    sql: SqlTemplate | string;
    schema: TSchema;
  }): Query<DeriveEntity<TSchema>> {
    const query = new ProxyQuery(
      new QuerySource({
        type: 'sql',
        sql: SqlTemplate.derive(options.sql),
        schema: toSchema(() => query, options.schema),
      })
    );
    return query;
  }

  constructor(
    public readonly source: QuerySource,
    public readonly projection: Projection
  ) {}

  /**
   * Implementation of the visitor pattern for {@link Query}
   * @param visitor will be used by descendants to call relevant methods
   */
  abstract visit<T>(visitor: QueryVisitor<T>): T;

  /**
   * Applies transformations to the query one by one. Result of a transformation is the input of the next.
   * @example
   *  function deletedUsers(query: Query<User>): Query<User> {
   *    return query.filter(user => user.deleted);
   *  }
   *
   *  function userInfo(query: Query<User>): Query<UserInfo> {
   *    return query.map(user => ({ id: user.id, name: user.name }))
   *  }
   *
   *  const deletedUserInfos = query.pipe(deletedUsers, userInfo);
   */
  pipe(): Query<T>;
  pipe<R>(fn1: (arg: Query<T>) => R): R;
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

  /**
   * Renders the query into SQL. PostgreSQL, MySQL and SQLite dialects are supported. For
   * other dialects consider writing your own rendering function. An example can be found
   * at [github](https://github.com/tilyupo/qustar/blob/4af9e814efd781d44989fa96fbff03f5ebdc07b9/packages/qustar/src/render/sql.ts#L70).
   * @param dialect describes what built-in SQL dialect to use for {@link Query} rendering
   * @param options additional options that affect query rendering process
   * @returns SQL command that can be used to query a database
   * @example
   *  const command = query.render('sqlite', { parameters: true });
   */
  render(dialect: Dialect, options?: RenderOptions): SqlCommand {
    return this.pipe(
      x => compileQuery(x, {parameters: false, ...options}),
      x => ((options?.optimize ?? true) ? optimize(x) : x),
      match(dialect)
        .with('sqlite', () => renderSqlite)
        .with('postgresql', () => renderPostgresql)
        .with('mysql', () => renderMysql)
        .exhaustive()
    );
  }

  /**
   * Runs the query using the connector.
   * @param connector database connector that will be used to run the query
   * @returns all rows that match the query
   * @example
   *  await usersQuery.fetch(connector);
   */
  async fetch(connector: Connector): Promise<T[]> {
    const command = connector.render(this.pipe(compileQuery, optimize));
    const rows = await connector.query({
      sql: command.sql,
      args: command.args,
    });

    return rows.map(row => materialize(row, this.projection));
  }

  /**
   * Runs the query using the connector and returns the first matching row
   * @param connector database connector that will be used to run the query
   * @returns first row that matches the query
   * @example
   *  await usersQuery.fetchFirst(connector);
   */
  async fetchFirst(connector: Connector): Promise<T | null> {
    const rows = await this.limit(1).fetch(connector);
    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  // modificators

  /**
   * Applies GROUP BY clause to the query.
   * @param param0 group by options
   * @returns query with group by applied
   *
   * @example
   *  // groups users by age and selects only groups with average height less than 10
   *  query.groupBy({
   *    by: user => user.age,
   *    select: user => ({
   *      count: Expr.count(1),
   *      meanHeight: user.height.mean()
   *    }),
   *    having: stats => stats.meanHeight.lt(10),
   *  })
   */
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

    return new GroupByQuery<any>(
      nextSource,
      projection,
      groupingExpr.map(Expr.from),
      havingExpr
    );
  }

  /**
   * Applies WHERE clause to the query.
   * @param filter function that accepts {@link Handle} and returns boolean expression
   * @returns query with filter applied
   * @example
   *  // filter users with age === 42
   *  query.filter(user => user.age.eq(42))
   */
  filter(filter: FilterFn<T>): Query<T> {
    return FilterQuery.create(this, filter);
  }

  /**
   * Alias for {@link Query.filter}. Applies WHERE clause to the query.
   *
   * @param filter function that accepts {@link Handle} and returns boolean expression
   * @returns query with filter applied
   * @example
   *  // filter users with age === 42
   *  query.where(user => user.age.eq(42))
   */
  where(filter: FilterFn<T>): Query<T> {
    return this.filter(filter);
  }

  /**
   * Applies a projection to the query. The projection, as every operation on a query,
   * will be translated to 100% SQL.
   * @param selector function that accepts {@link Handle} and returns a projection
   * @returns query with projection applied
   * @example
   *  query.map(user => ({
   *    id: user.id,
   *    fullName: user.firstName.concat(' ', user.lastName),
   *  }))
   */
  map<Result extends Mapping>(
    selector: MapValueFn<T, Result>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    const nextSource = new QuerySource({type: 'query', query: this});
    const handle = createHandle(nextSource);
    const result = selector(handle);

    const mapping = inferProjection(result);
    return new MapQuery<any>(nextSource, mapping);
  }

  /**
   * Alias for {@link Query.map}
   *
   * Applies a projection to the query. The projection, as every operation on a query,
   * will be translated to 100% SQL.
   * @param selector function that accepts {@link Handle} and returns a projection
   * @returns query with projection applied
   * @example
   *  query.select(user => ({
   *    id: user.id,
   *    fullName: user.firstName.concat(' ', user.lastName),
   *  }))
   */
  select<TMapping extends Mapping>(
    selector: MapValueFn<T, TMapping>
  ): Query<Expand<ConvertMappingToValue<TMapping>>> {
    return this.map<any>(selector);
  }

  /**
   * Applies `ORDER BY <expr> ASC` clause. This method overrides previous ordering of the query.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with ascending order applied
   * @example
   *  query.orderByAsc(user => user.age);
   */
  orderByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(
      new QuerySource({type: 'query', query: this}),
      [],
      {selector, options: {asc: true}}
    );
  }

  /**
   * Applies `ORDER BY <expr> DESC` clause. This method overrides previous ordering of the query.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with descending order applied
   * @example
   *  query.orderByDesc(user => user.age);
   */
  orderByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return OrderByQuery.create(
      new QuerySource({type: 'query', query: this}),
      [],
      {selector, options: {desc: true}}
    );
  }

  /**
   * Applies `ORDER BY ... <expr> ASC` clause. If it follows another ordering operation, then it will apply a secondary order for records with matching primary order.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with ascending order applied
   * @example
   *  query
   *    .orderByDesc(user => user.age)
   *    .thenByAsc(user => user.height);
   */
  thenByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return this.orderByAsc(selector);
  }

  /**
   * Applies `ORDER BY ... <expr> DESC` clause. If it follows another ordering operation, then it will apply a secondary order for records with matching primary order.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with descending order applied
   * @example
   *  query
   *    .orderByDesc(user => user.age)
   *    .thenByDesc(user => user.height);
   */
  thenByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): OrderByQuery<T> {
    return this.orderByDesc(selector);
  }

  /**
   * Alias for {@link Query.orderByDesc}.
   *
   * Applies descending order to the query.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with descending order applied
   * @example
   *  query.sortByAsc(user => user.age);
   */
  sortByDesc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): Query<T> {
    return this.orderByDesc(selector);
  }

  /**
   * Alias for {@link Query.orderByAsc}.
   *
   * Applies ascending order to the query.
   * @param selector function that accepts {@link Handle} and returns an expression that will be used to order the query by
   * @returns query with ascending order applied
   * @example
   *  query.sortByAsc(user => user.age);
   */
  sortByAsc<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): Query<T> {
    return this.orderByAsc(selector);
  }

  /**
   * Applies `JOIN` clause to the query. It's usually more convenient to use `innerJoin`, `leftJoin`, `rightJoin` instead of just this method.
   * @param options join operation options
   * @returns query with join applied
   * @example
   *  postsQuery.join({
   *    type: 'inner',
   *    right: usersQuery,
   *    condition: (post, user) => user.id.eq(post.authorId),
   *    select: (post, user) => ({...post, author: user}),
   *  });
   */
  join<Right extends ValidValue<Right>, Result extends Mapping>(
    options: JoinOptionsPublic<T, Right, Result>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    const left = new QuerySource({type: 'query', query: this});
    const right = new QuerySource({
      type: 'query',
      query: options.right,
    });

    const leftProjHandle = createHandle(left, options.type === 'right');
    const rightProjHandle = createHandle(right, options.type === 'left');

    return new JoinQuery<any>(left, {
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

  /**
   * Applies `LEFT JOIN` clause to the query.
   * @param options join operation options
   * @returns query with left join applied
   * @example
   *  postsQuery.leftJoin({
   *    right: usersQuery,
   *    condition: (post, user) => user.id.eq(post.reviewerId),
   *    select: (post, user) => ({...post, reviewer: user}),
   *  });
   */
  leftJoin<Right extends ValidValue<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'left',
    });
  }

  /**
   * Applies `INNER JOIN` clause to the query.
   * @param options join operation options
   * @returns query with left join applied
   * @example
   *  postsQuery.innerJoin({
   *    right: usersQuery,
   *    condition: (post, user) => user.id.eq(post.authorId),
   *    select: (post, user) => ({...post, author: user}),
   *  });
   */
  innerJoin<Right extends ValidValue<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'inner',
    });
  }

  /**
   * Applies `RIGHT JOIN` clause to the query.
   * @param options join operation options
   * @returns query with left join applied
   * @example
   *  postsQuery.rightJoin({
   *    right: usersQuery,
   *    condition: (post, user) => user.id.eq(post.authorId),
   *    select: (post, user) => ({...post, author: user}),
   *  });
   */
  rightJoin<Right extends ValidValue<Right>, Result extends Mapping>(
    options: Omit<JoinOptionsPublic<T, Right, Result>, 'type'>
  ): Query<Expand<ConvertMappingToValue<Result>>> {
    return this.join({
      ...options,
      type: 'right',
    });
  }

  /**
   * Maps every item of a query to many (possible zero) items.
   * @param selector function that accepts {@link Handle} and returns a query
   * @returns query that consists of concatenated result of all subqueries
   * @example
   *  const allPosts = usersQuery.flatMap(user =>
   *    postsQuery.filter(post => post.authorId.eq(user.id))
   *  );
   */
  flatMap<Result = any>(selector: MapQueryFn<T, Result>): Query<Result> {
    const nextSource: QuerySource = new QuerySource({
      type: 'query',
      query: this,
    });
    const leftHandle = createHandle(nextSource);
    const target = selector(leftHandle);

    if (!(target instanceof Query)) {
      throw new Error('flatMap can only map to a query');
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

  /**
   * Alias for {@link Query.flatMap}.
   *
   * Maps every item of a query to many (possible zero) items.
   * @param selector function that accepts {@link Handle} and returns a query
   * @returns query that consists of concatenated result of all subqueries
   * @example
   *  const allPosts = usersQuery.selectMany(user =>
   *    postsQuery.filter(post => post.authorId.eq(user.id))
   *  );
   */
  selectMany<Result = any>(selector: MapQueryFn<T, Result>): Query<Result> {
    return this.flatMap(selector);
  }

  private combine(options: CombineOptions<T>): Query<T> {
    return new CombineQuery(
      new QuerySource({type: 'query', query: this}),
      options
    );
  }

  /**
   * Applies `UNION` clause.
   * @param query another query to union with
   * @returns a combined query that has all unique values from both queries
   * @example
   *  studentsQuery.union(teachersQuery)
   */
  union(query: Query<T>): Query<T> {
    return this.combine({
      type: 'union',
      other: query,
    });
  }

  /**
   * Applies `UNION ALL` clause.
   * @param query another query to union with
   * @returns a combined query that has all (possibly duplicate) values from both queries
   * @example
   *  studentsQuery.unionAll(teachersQuery)
   */
  unionAll(query: Query<T>): Query<T> {
    return this.combine({
      type: 'union_all',
      other: query,
    });
  }

  /**
   * Applies `INTERSECT` clause.
   * @param query another query to intersect with
   * @returns query that represents the dataset that is common in both the original queries
   * @example
   *  studentsQuery.intersect(teachersQuery)
   */
  intersect(query: Query<T>): Query<T> {
    return this.combine({
      type: 'intersect',
      other: query,
    });
  }

  /**
   * Applies `EXCEPT` clause.
   * @param query another (right) query to except with
   * @returns
   * query that represents all the unique records from the left query,
   * except the records that are present in the result set of the right query
   * @example
   *  studentsQuery.except(teachersQuery)
   */
  except(query: Query<T>): Query<T> {
    return this.combine({
      type: 'except',
      other: query,
    });
  }

  /**
   * Combines two queries. Original ordering of the queries is preserved.
   * @param query query to concatenate to the end of the original query
   * @returns query with second query concatenated to the end of the first
   * @remark
   * Under the hood `qustar` uses `UNION ALL` with post-ordering to preserve original ordering of
   * the queries.
   * @example
   *  studentsQuery.concat(teachersQuery)
   */
  concat(query: Query<T>): Query<T> {
    return this.combine({
      type: 'concat',
      other: query,
    });
  }

  /**
   * Applies `DISTINCT` keyword to the query.
   * @returns query with only distinct values in it
   * @example
   *  users.map(user => user.name).unique();
   */
  unique(): Query<T> {
    return new UniqueQuery(new QuerySource({type: 'query', query: this}));
  }

  /**
   * Alias for {@link Query.unique}.
   *
   * Applies `DISTINCT` keyword to the query.
   * @returns query with only distinct values in it
   * @example
   *  users.map(user => user.name).distinct();
   */
  distinct(): Query<T> {
    return this.unique();
  }

  /**
   * Alias for {@link Query.unique}.
   *
   * Applies `DISTINCT` keyword to the query.
   * @returns query with only distinct values in it
   * @example
   *  users.map(user => user.name).uniq();
   */
  uniq(): Query<T> {
    return this.unique();
  }

  /**
   * Limits number of items that query can return.
   * @param limit number of items to query
   * @param offset number of items to skip
   * @returns query with at most `limit` number of items
   * @example
   *  posts.orderByDesc(post => = post.createdAt).limit(10);
   * @example
   *  posts.orderByDesc(post => = post.createdAt).limit(5, 15);
   */
  limit(limit: number, offset?: number): Query<T> {
    return new PaginationQuery(
      new QuerySource({type: 'query', query: this}),
      limit,
      offset
    );
  }

  /**
   * Returns a slice of an original query.
   * In contrast to `Array.slice`, `Query.slice` doesn't support negative indexes.
   * @param start
   * The beginning index of the specified portion of the query.
   * If start is undefined, then the slice begins at index 0.
   * @param end
   * The end index of the specified portion of the query.
   * This is exclusive of the element at the index 'end'.
   * If end is undefined, then the slice extends to the end of the query.
   * @example
   *  users.slice(10, 15);
   */
  slice(start?: number, end?: number): Query<T> {
    if (end !== undefined) {
      return this.limit(end - (start ?? 0), start);
    } else {
      return this.skip(start ?? 0);
    }
  }

  /**
   * Alias for {@link Query.limit}
   *
   * Limits number of items that query can return.
   * @param count number of items to query
   * @param skip number of items to skip
   * @returns query with at most `count` number of items
   * @example
   *  posts.orderByDesc(post => = post.createdAt).take(10);
   * @example
   *  posts.orderByDesc(post => = post.createdAt).take(5, 15);
   */
  take(count: number, skip?: number): Query<T> {
    return this.limit(count, skip);
  }

  /**
   * Drops first `offset` number of items.
   * @param offset number of items to skip from the original query
   * @returns query without first `offset` number of items
   * @example
   *  users.drop(10);
   */
  drop(count: number): Query<T> {
    return this.skip(count);
  }

  /**
   * Alias for {@link Query.drop}
   *
   * Skips first `count` number of items.
   * @param count number of items to skip from the original query
   * @returns query without first `count` number of items
   * @example
   *  users.skip(10);
   */
  skip(count: number): Query<T> {
    // SQL doesn't allow to use OFFSET without LIMIT
    return new PaginationQuery(
      new QuerySource({type: 'query', query: this}),
      1_000_000_000_000_000,
      count
    );
  }

  // terminators

  max<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return new QueryTerminatorExpr('max', this.map(selector));
  }

  min<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return new QueryTerminatorExpr('min', this.map(selector));
  }

  mean<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return new QueryTerminatorExpr('mean', this.map(selector));
  }

  avg<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return this.mean(selector);
  }

  average<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return this.mean(selector);
  }

  sum<Scalar extends NumericMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return new QueryTerminatorExpr('sum', this.map(selector));
  }

  first<Scalar extends ScalarMapping>(
    selector: MapScalarFn<T, Scalar>
  ): QueryTerminatorExpr<Expand<
    ConvertScalarMappingToScalarValue<Scalar>
  > | null> {
    return new QueryTerminatorExpr('first', this.map(selector));
  }

  contains<R extends Nullable<T>>(
    value: SingleScalarOperand<R & SingleLiteralValue>
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

export class FilterQuery<T extends ValidValue<T>> extends Query<T> {
  static create<T extends ValidValue<T>>(
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

export class MapQuery<T extends ValidValue<T>> extends Query<T> {
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
  T extends ValidValue<T>,
  Scalar extends ScalarMapping,
> {
  readonly selector: MapScalarFn<T, Scalar>;
  readonly options: OrderByOptions;
}

export class OrderByQuery<T extends ValidValue<T>> extends Query<T> {
  static create<T extends ValidValue<T>, Scalar extends ScalarMapping>(
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

export class JoinQuery<T extends ValidValue<T>> extends Query<T> {
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

export class FlatMapQuery<T extends ValidValue<T>> extends JoinQuery<T> {
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

export class CombineQuery<T extends ValidValue<T>> extends Query<T> {
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
export class UniqueQuery<T extends ValidValue<T>> extends Query<T> {
  constructor(source: QuerySource) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.unique(this);
  }
}

export class PaginationQuery<T extends ValidValue<T>> extends Query<T> {
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

export class ProxyQuery<T extends ValidValue<T>> extends Query<T> {
  constructor(source: QuerySource) {
    super(source, proxyProjection(source));
  }

  visit<T>(visitor: QueryVisitor<T>): T {
    return visitor.proxy(this);
  }
}

export class GroupByQuery<T extends ValidValue<T>> extends Query<T> {
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

export interface DeleteOptions<T extends ValidValue<T>> {
  filter: FilterFn<T>;
}

export type UpdateFn<T extends object> = (handle: Handle<T>) => UpdateSet<T>;

export interface UpdateOptions<T extends object> {
  readonly set: UpdateFn<T>;
  readonly filter: FilterFn<T>;
}

export class TableQuery<TSchema extends EntityDescriptor> extends ProxyQuery<
  DeriveEntity<TSchema>
> {
  constructor(public readonly table: Table<TSchema>) {
    const schema: (query: () => Query<any>) => Schema = query =>
      toSchema(query, table.schema);
    super(
      new QuerySource({
        type: 'table',
        name: table.name,
        schema: schema(() => this),
      })
    );
  }

  delete(filter: FilterFn<DeriveEntity<TSchema>>): DeleteStmt<TSchema> {
    return new DeleteStmt(
      this.table,
      this.source,
      Expr.from(filter(createHandle(this.source)))
    );
  }

  insert(...rows: DeriveEntity<TSchema>[]): InsertStmt<TSchema> {
    return new InsertStmt(this.table, rows);
  }

  update(options: UpdateOptions<DeriveEntity<TSchema>>): UpdateStmt<TSchema> {
    return new UpdateStmt(
      this.table,
      this.source,
      options.set(createHandle(this.source)),
      Expr.from(options.filter(createHandle(this.source)))
    );
  }
}

export interface StmtVisitor<T> {
  delete(stmt: DeleteStmt<any>): T;
  insert(stmt: InsertStmt<any>): T;
  update(stmt: UpdateStmt<any>): T;
}

export abstract class Stmt<TSchema extends EntityDescriptor> {
  constructor(public readonly table: Table<TSchema>) {}

  abstract visit<T>(visitor: StmtVisitor<T>): T;

  async execute(connector: Connector): Promise<void> {
    const compilationResult = compileStmt(this, {parameters: false});
    const command = connector.render(compilationResult);
    assert(
      command.args.length === 0,
      'parametrized statements are not supported'
    );
    await connector.execute(command.sql);
  }
}

export class DeleteStmt<
  TSchema extends EntityDescriptor,
> extends Stmt<TSchema> {
  constructor(
    table: Table<TSchema>,
    public readonly source: QuerySource,
    public readonly filter: Expr<boolean | null>
  ) {
    super(table);
  }

  visit<T>(visitor: StmtVisitor<T>): T {
    return visitor.delete(this);
  }
}

export class InsertStmt<
  TSchema extends EntityDescriptor,
> extends Stmt<TSchema> {
  constructor(
    table: Table<TSchema>,
    public readonly rows: DeriveEntity<TSchema>[]
  ) {
    super(table);
  }

  visit<T>(visitor: StmtVisitor<T>): T {
    return visitor.insert(this);
  }
}

type UpdateSet<T extends object> = {
  [K in keyof T]?: T[K] extends SingleLiteralValue
    ? SingleScalarOperand<T[K]>
    : never;
};

export class UpdateStmt<
  TSchema extends EntityDescriptor,
> extends Stmt<TSchema> {
  constructor(
    table: Table<TSchema>,
    public readonly source: QuerySource,
    public readonly set: UpdateSet<DeriveEntity<TSchema>>,
    public readonly filter: Expr<boolean | null>
  ) {
    super(table);
  }

  visit<T>(visitor: StmtVisitor<T>): T {
    return visitor.update(this);
  }
}
