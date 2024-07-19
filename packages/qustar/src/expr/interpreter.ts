import {P, match} from 'ts-pattern';
import {SingleLiteralValue} from '../literal.js';
import {Value} from '../types.js';
import {
  assert,
  assertNever,
  compare,
  deepEqual,
  like,
  setPath,
} from '../utils.js';
import {
  BinaryExpr,
  CaseExpr,
  Expr,
  FuncExpr,
  LiteralExpr,
  LocatorExpr,
  QueryTerminatorExpr,
  UnaryExpr,
} from './expr.js';
import {ObjectProjection, Projection, ScalarProjection} from './projection.js';
import {
  CombineQuery,
  FilterQuery,
  FlatMapQuery,
  GroupByQuery,
  JoinQuery,
  MapQuery,
  OrderByQuery,
  PaginationQuery,
  ProxyQuery,
  Query,
  QuerySource,
  UniqueQuery,
  createHandle,
} from './query.js';
import {ChildrenRef, Collection, ParentRef, Ref} from './schema.js';

type Dynamic = any;

export type Database = Record<string, object[]>;

export interface InterpretOptions {
  readonly db: Database;
}

type Scope = Map<QuerySource, unknown>;

class IntContext {
  constructor(
    public readonly options: InterpretOptions,
    public readonly scope: Scope
  ) {}

  with(...scope: [variable: QuerySource, value: unknown][]): IntContext {
    const newScope = new Map(this.scope);
    scope.forEach(([variable, value]) => newScope.set(variable, value));
    return new IntContext(this.options, newScope);
  }
}

export function interpretQuery<T extends SingleLiteralValue>(
  expr: QueryTerminatorExpr<T>,
  options: InterpretOptions
): [T];
export function interpretQuery<T extends Value<T>>(
  query: Query<T>,
  options: InterpretOptions
): T[];
export function interpretQuery(
  query: Query<any> | QueryTerminatorExpr<any>,
  options: InterpretOptions
): any {
  const ctx = new IntContext(options, new Map());

  if (query instanceof Query) {
    return intQuery(query, ctx);
  } else {
    return [intQueryTerminator(query, ctx)];
  }
}

function intQuery(query: Query<any>, ctx: IntContext): unknown[] {
  return query.visit({
    proxy: x => intProxy(x, ctx),
    filter: x => intFilter(x, ctx),
    map: x => intMap(x, ctx),
    orderBy: x => intOrderBy(x, ctx),
    groupBy: x => intGroupBy(x, ctx),
    join: x => intJoin(x, ctx),
    combine: x => intCombine(x, ctx),
    unique: x => intUnique(x, ctx),
    pagination: x => intPagination(x, ctx),
    flatMap: x => intFlatMap(x, ctx),
  });
}

function intProjection(proj: Projection, ctx: IntContext): unknown {
  return match(proj)
    .with({type: 'scalar'}, x => intScalarProjection(x, ctx))
    .with({type: 'object'}, x => intObjectProjection(x, ctx))
    .exhaustive();
}

function intScalarProjection(proj: ScalarProjection, ctx: IntContext): unknown {
  return intExpr(proj.expr, ctx);
}

function intObjectProjection(proj: ObjectProjection, ctx: IntContext): unknown {
  const result: object = {};
  for (const prop of proj.props) {
    if (prop.type === 'wildcard') {
      // todo: handle refs
      Object.assign(result);
    } else if (prop.type === 'single') {
      setPath(result, prop.path, intExpr(prop.expr, ctx));
    } else {
      assertNever(prop, 'invalid prop: ' + prop);
    }
  }

  // todo: handle refs
  // for (const ref of proj.refs) {
  //   // todo: extract to a separate function
  //   let rollingObj = result;
  //   for (const part of ref.path.slice(0, -1)) {
  //     if (!(part in rollingObj)) {
  //       rollingObj[part] = {};
  //     }

  //     rollingObj = rollingObj[part];
  //   }

  //   const lastPart = ref.path[ref.path.length - 1];
  //   Object.defineProperty(rollingObj, lastPart, {
  //     get: () => {
  //       const source = new QuerySource({type: ""})
  //       resolveRef(source, rollingObj, ref, ctx)
  //     },
  //   });
  // }

  return result;
}

function intProxy(query: ProxyQuery<Dynamic>, ctx: IntContext): unknown[] {
  return intQuerySource(query.source, ctx);
}

function intFilter(query: FilterQuery<Dynamic>, ctx: IntContext): unknown[] {
  const sourceEntities = intQuerySource(query.source, ctx);

  return sourceEntities.filter(entity =>
    intExpr(query.filterExpr, ctx.with([query.source, entity]))
  );
}

function intMap(query: MapQuery<Dynamic>, ctx: IntContext): unknown[] {
  const sourceEntities = intQuerySource(query.source, ctx);
  const result: unknown[] = [];
  for (const entity of sourceEntities) {
    result.push(
      intProjection(query.projection, ctx.with([query.source, entity]))
    );
  }

  return result;
}

function intOrderBy(query: OrderByQuery<Dynamic>, ctx: IntContext): unknown[] {
  const sourceEntities = intQuerySource(query.source, ctx);
  const entries: [result: unknown, terms: unknown[]][] = [];
  for (const entity of sourceEntities) {
    const terms = query.terms.map(x =>
      intExpr(x.expr, ctx.with([query.source, entity]))
    );
    entries.push([entity, terms]);
  }

  return entries
    .sort(([, aTerms], [, bTerms]) => {
      for (let i = 0; i < query.terms.length; i += 1) {
        const a = aTerms[i];
        const b = bTerms[i];
        const term = query.terms[i];
        const reverse = term.options.desc ? -1 : 1;

        if (a === b) {
          continue;
        }

        if (nullish(a)) {
          return (
            reverse *
            match(term.options.nulls)
              .with(P.union('first', undefined), () => -1)
              .with('last', () => 1)
              .exhaustive()
          );
        }

        if (nullish(b)) {
          return (
            reverse *
            match(term.options.nulls)
              .with(P.union('first', undefined), () => 1)
              .with('last', () => -1)
              .exhaustive()
          );
        }

        return reverse * compare(a, b);
      }

      return 1;
    })
    .map(([value]) => value);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function intGroupBy(query: GroupByQuery<Dynamic>, ctx: IntContext): unknown[] {
  throw new Error('group by interpretation is not supported');
}

function intJoin(query: JoinQuery<Dynamic>, ctx: IntContext): unknown[] {
  const leftEntities = intQuerySource(query.source, ctx);
  const rightEntities = intQuerySource(query.options.right, ctx);

  const entries = match(query.options.type)
    .with('full', () => intFullJoin(leftEntities, rightEntities, query, ctx))
    .with('inner', () => intInnerJoin(leftEntities, rightEntities, query, ctx))
    .with('left', () => intLeftJoin(leftEntities, rightEntities, query, ctx))
    .with('right', () => intRightJoin(leftEntities, rightEntities, query, ctx))
    .exhaustive();

  return entries.map(([left, right]) =>
    intProjection(
      query.options.projection,
      ctx.with([query.source, left], [query.options.right, right])
    )
  );
}

function intInnerJoin(
  leftEntities: unknown[],
  rightEntities: unknown[],
  query: JoinQuery<Dynamic>,
  ctx: IntContext
): [left: unknown, right: unknown][] {
  return intFullJoin(leftEntities, rightEntities, query, ctx).filter(
    ([left, right]) => left !== null && right !== null
  );
}

function intLeftJoin(
  leftEntities: unknown[],
  rightEntities: unknown[],
  query: JoinQuery<Dynamic>,
  ctx: IntContext
): [left: unknown, right: unknown][] {
  return intFullJoin(leftEntities, rightEntities, query, ctx).filter(
    ([left]) => left !== null
  );
}

function intRightJoin(
  leftEntities: unknown[],
  rightEntities: unknown[],
  query: JoinQuery<Dynamic>,
  ctx: IntContext
): [left: unknown, right: unknown][] {
  return intFullJoin(leftEntities, rightEntities, query, ctx).filter(
    ([, right]) => right !== null
  );
}

// Table A:           Table B:
// +----+-----+       +----+------+
// | id | val |       | id | val  |
// +----+-----+       +----+------+
// | 1  | A1  |       | 3  | B2   |
// | 2  | A2  |       | 2  | B1   |
// | 3  | A3  |       | 4  | B3   |
// +----+-----+       +----+------+
//
// A FULL JOIN B ON A.id = B.id
//
// result order:
// 1. inner join
//    - left ASC
//    - right ASC
// 2. left join
//    - left ASC
//    - null
// 3. right join
//    - null
//    - right ASC
//
// +------+------+------+------+
// | id   | val  | id   | val  |
// +------+------+------+------+
// | 2    | A2   | 2    | B1   |
// | 3    | A3   | 3    | B2   |
// | 1    | A1   | NULL | NULL |
// | NULL | NULL | 4    | B3   |
// +------+------+------+------+

function intFullJoin(
  leftEntities: unknown[],
  rightEntities: unknown[],
  query: JoinQuery<Dynamic>,
  ctx: IntContext
): [left: unknown, right: unknown][] {
  const matches: [leftIdx: number, rightIdx: number][] = [];
  for (let leftIdx = 0; leftIdx < leftEntities.length; leftIdx += 1) {
    for (let rightIdx = 0; rightIdx < rightEntities.length; rightIdx += 1) {
      const left = leftEntities[leftIdx];
      const right = rightEntities[rightIdx];
      if (query.options.filterExpr) {
        const condition = intExpr(
          query.options.filterExpr,
          ctx.with([query.source, left], [query.options.right, right])
        );
        if (condition) {
          matches.push([leftIdx, rightIdx]);
        }
      } else {
        matches.push([leftIdx, rightIdx]);
      }
    }
  }

  const result: [left: unknown, right: unknown][] = matches.map(
    ([leftIdx, rightIdx]) => [leftEntities[leftIdx], rightEntities[rightIdx]]
  );
  for (let i = 0; i < leftEntities.length; i += 1) {
    if (matches.every(([leftIdx]) => leftIdx !== i)) {
      result.push([leftEntities[i], null]);
    }
  }
  for (let i = 0; i < rightEntities.length; i += 1) {
    if (matches.every(([, rightIdx]) => rightIdx !== i)) {
      result.push([null, rightEntities[i]]);
    }
  }

  return result;
}

function intCombine(query: CombineQuery<Dynamic>, ctx: IntContext): unknown[] {
  const rightSource = new QuerySource({
    type: 'query',
    query: query.options.other,
  });
  const left = intQuerySource(query.source, ctx);
  const right = intQuerySource(rightSource, ctx);

  return match(query.options.type)
    .with('concat', () => intConcat(left, right))
    .with('except', () => intExcept(left, right))
    .with('union', () => intUnion(left, right))
    .with('union_all', () => intUnionAll(left, right))
    .with('intersect', () => intIntersect(left, right))
    .exhaustive();
}

function intConcat(left: unknown[], right: unknown[]): unknown[] {
  return left.concat(right);
}

function intUnion(left: unknown[], right: unknown[]): unknown[] {
  return intUniqueRaw(intUnionAll(left, right));
}

function intUnionAll(left: unknown[], right: unknown[]): unknown[] {
  // todo: add shuffle?
  return left.concat(right);
}

function intExcept(left: unknown[], right: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const a of intUniqueRaw(left)) {
    let unique = true;
    for (const b of right) {
      if (deepEqual(a, b)) {
        unique = false;
        break;
      }
    }

    if (unique) {
      result.push(a);
    }
  }

  return result;
}

function intIntersect(left: unknown[], right: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const a of intUniqueRaw(left)) {
    let unique = true;
    for (const b of right) {
      if (deepEqual(a, b)) {
        unique = false;
        break;
      }
    }

    if (!unique) {
      result.push(a);
    }
  }

  return result;
}

function intUnique(query: UniqueQuery<Dynamic>, ctx: IntContext): unknown[] {
  const sourceEntities = intQuerySource(query.source, ctx);
  return intUniqueRaw(sourceEntities);
}

function intUniqueRaw(entities: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    let unique = true;
    for (let j = i + 1; j < entities.length; j += 1) {
      if (deepEqual(entity, entities[j])) {
        unique = false;
        break;
      }
    }

    if (unique) {
      result.push(entity);
    }
  }

  return result;
}

function intFlatMap(query: FlatMapQuery<Dynamic>, ctx: IntContext): unknown[] {
  // flat map uses inner join
  // interpreter inner join preserves order (left then right)
  return intJoin(query, ctx);
}

function intPagination(
  query: PaginationQuery<Dynamic>,
  ctx: IntContext
): unknown[] {
  const entities = intQuerySource(query.source, ctx);
  const offset = query.offset_ ?? 0;
  return entities.slice(offset, offset + query.limit_);
}

function intQuerySource(source: QuerySource, ctx: IntContext): unknown[] {
  return match(source.inner)
    .with({type: 'query'}, x => intQuery(x.query, ctx))
    .with({type: 'view'}, () => {
      throw new Error('can not interpret sql view');
    })
    .with({type: 'collection'}, ({collection}) =>
      intCollection(source, collection, ctx)
    )
    .exhaustive();
}

function intCollection(
  source: QuerySource,
  collection: Collection,
  ctx: IntContext
): unknown[] {
  const documents = ctx.options.db[collection.name] ?? [];
  const result: unknown[] = [];

  for (const doc of documents) {
    const entity: object = {};
    if (collection.schema.additionalProperties) {
      Object.assign(entity, doc);
    }

    for (const field of collection.schema.fields) {
      if (field.name in entity) {
        throw new Error(`entity already has field ${field.name}`);
      }

      // todo: support remapping from doc filed name to entity field name
      if (field.name in doc) {
        // safety: checked that filed.name in doc
        let value = (doc as any)[field.name];
        if (field.scalarType.type === 'boolean') {
          value = !!value;
        }
        (entity as any)[field.name] = value;
      }
    }

    for (const ref of collection.schema.refs) {
      let rollingObj = entity;
      for (const part of ref.path.slice(0, -1)) {
        if (!(part in rollingObj)) {
          (rollingObj as any)[part] = {};
        }

        // safety: added part if doesn't exist
        rollingObj = (rollingObj as any)[part];

        if (typeof rollingObj !== 'object' || rollingObj instanceof Date) {
          throw new Error('invalid ref: ' + ref);
        }
      }

      const lastPart = ref.path[ref.path.length - 1];
      Object.defineProperty(rollingObj, lastPart, {
        get: () => resolveRef(source, rollingObj, ref, ctx),
      });
    }

    result.push(entity);
  }

  return result;
}

function resolveRef(
  source: QuerySource,
  entity: unknown,
  ref: Ref,
  ctx: IntContext
): unknown {
  return match(ref)
    .with({type: 'parent'}, x => resolveParentRef(source, entity, x, ctx))
    .with({type: 'children'}, x => resolveChildrenRef(source, entity, x, ctx))
    .exhaustive();
}

// it's likely broken when ref was nested inside another object
function resolveParentRef(
  source: QuerySource,
  child: unknown,
  ref: ParentRef,
  ctx: IntContext
): unknown {
  const parentSource = new QuerySource({
    type: 'query',
    query: ref.parent(),
  });
  const condition = Expr.from(
    ref.condition(createHandle(parentSource), createHandle(source))
  );

  const parentEntities = intQuerySource(parentSource, ctx);
  const matching = parentEntities.filter(parent =>
    intExpr(condition, ctx.with([parentSource, parent], [source, child]))
  );

  if (matching.length > 0) {
    throw new Error(
      'invalid parent reference: reference must point to at most one entity. ' +
        JSON.stringify(ref, null, 2)
    );
  }

  if (!ref.nullable && matching.length === 0) {
    throw new Error(
      'invalid parent reference: non nullable reference must point to exactly one entity'
    );
  }

  return matching[0];
}

// it's likely broken when ref was nested inside another object
function resolveChildrenRef(
  source: QuerySource,
  parent: unknown,
  ref: ChildrenRef,
  ctx: IntContext
): object {
  const childrenSource = new QuerySource({
    type: 'query',
    query: ref.child(),
  });
  const condition = Expr.from(
    ref.condition(createHandle(source), createHandle(childrenSource))
  );

  const children = intQuerySource(childrenSource, ctx);
  const matching = children.filter(child =>
    intExpr(condition, ctx.with([source, parent], [childrenSource, child]))
  );

  return matching;
}

function intExpr(expr: Expr<Dynamic>, ctx: IntContext): unknown {
  return expr.visit({
    binary: x => intBinary(x, ctx),
    unary: x => intUnary(x, ctx),
    literal: x => intLiteral(x),
    case: x => intCase(x, ctx),
    queryTerminator: x => intQueryTerminator(x, ctx),
    func: x => intFunc(x, ctx),
    locator: x => intLocator(x, ctx),
    sql: () => intSql(),
  });
}

function createFallback(...args: unknown[]) {
  return (happyPath: () => unknown, value: unknown) => {
    if (args.some(x => x === null)) {
      return value;
    }

    return happyPath();
  };
}

function intBinary(expr: BinaryExpr<Dynamic>, ctx: IntContext): unknown {
  const lhs = intExpr(expr.lhs, ctx);
  const rhs = intExpr(expr.rhs, ctx);
  const fallback = createFallback(lhs, rhs);

  return match(expr.op)
    .with('!=', () => lhs !== rhs)
    .with('==', () => lhs === rhs)
    .with('<', () => fallback(() => compare(lhs, rhs) < 0, false))
    .with('<=', () => fallback(() => compare(lhs, rhs) <= 0, false))
    .with('>', () => fallback(() => compare(lhs, rhs) > 0, false))
    .with('>=', () => fallback(() => compare(lhs, rhs) >= 0, false))
    .with('and', () => (lhs ?? false) && (rhs ?? false))
    .with('or', () => (lhs ?? false) || (rhs ?? false))
    .with('in', () =>
      fallback(() => {
        if (!Array.isArray(rhs)) {
          throw new Error('to the right of the in must be an array');
        }

        rhs.some(x => compare(x, lhs) === 0);
      }, false)
    )
    .with('like', () =>
      fallback(() => {
        if (typeof lhs !== 'string' || typeof rhs !== 'string') {
          throw new Error('like works only on strings');
        }

        return like(lhs, rhs);
      }, false)
    )
    .with('&', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('& works on numbers');
        }
        return lhs & rhs;
      }, null)
    )
    .with('<<', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('<< works on numbers');
        }
        return lhs << rhs;
      }, null)
    )
    .with('>>', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('>> works on numbers');
        }
        return lhs >> rhs;
      }, null)
    )
    .with('|', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('| works on numbers');
        }
        return lhs | rhs;
      }, null)
    )
    .with('^', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('^ works on numbers');
        }
        return lhs ^ rhs;
      }, null)
    )
    .with('%', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('% works on numbers');
        }
        return lhs % rhs;
      }, null)
    )
    .with('*', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('* works on numbers');
        }
        return lhs * rhs;
      }, null)
    )
    .with('+', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('+ works on numbers');
        }
        return lhs + rhs;
      }, null)
    )
    .with('-', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('- works on numbers');
        }
        return lhs - rhs;
      }, null)
    )
    .with('/', () =>
      fallback(() => {
        if (typeof lhs !== 'number' || typeof rhs !== 'number') {
          throw new Error('/ works on numbers');
        }
        return lhs / rhs;
      }, null)
    )
    .exhaustive();
}

function intUnary(expr: UnaryExpr<Dynamic>, ctx: IntContext): unknown {
  const inner = intExpr(expr.inner, ctx);
  const fallback = createFallback(inner);
  return match(expr.op)
    .with('!', () =>
      fallback(() => {
        if (typeof inner !== 'boolean' && typeof inner !== 'number') {
          throw new Error('! works on booleans: ' + inner);
        }
        return !inner;
      }, true)
    )
    .with('+', () =>
      fallback(() => {
        if (typeof inner !== 'number') {
          throw new Error('+ works on numbers');
        }
        return +inner;
      }, null)
    )
    .with('-', () =>
      fallback(() => {
        if (typeof inner !== 'number') {
          throw new Error('- works on numbers');
        }
        return -inner;
      }, null)
    )
    .with('~', () =>
      fallback(() => {
        if (typeof inner !== 'number') {
          throw new Error('~ works on numbers');
        }
        return ~inner;
      }, null)
    )
    .exhaustive();
}

function intLiteral(expr: LiteralExpr<Dynamic>): unknown {
  return expr.literal.value;
}

function intCase(expr: CaseExpr<Dynamic>, ctx: IntContext): unknown {
  const subject = intExpr(expr.subject, ctx);
  const result =
    expr.whens.find(x => intExpr(x.condition, ctx) === subject)?.result ??
    expr.fallback;

  return intExpr(result, ctx);
}

function intFunc(expr: FuncExpr<Dynamic>, ctx: IntContext): unknown {
  return match(expr.func)
    .with(P.union('avg', 'count', 'max', 'min', 'sum'), () => {
      throw new Error('aggregation functions can not be interpreted');
    })
    .with('concat', () =>
      expr.args
        .map(x => intExpr(x, ctx))
        .reduce((a, b) => {
          if (typeof a !== 'string' || typeof b !== 'string') {
            throw new Error('concat works only with strings');
          }

          return a.concat(b);
        })
    )
    .with('to_string', () => {
      const x = intExpr(expr.args[0], ctx);
      if (x === null) return null;
      if (x === true) return 'true';
      if (x === false) return 'false';
      if (
        typeof x === 'number' ||
        typeof x === 'object' ||
        typeof x === 'string'
      ) {
        return x.toString();
      }

      throw new Error('unsupported value for toString: ' + x);
    })
    .with('to_int', () => {
      const x = intExpr(expr.args[0], ctx);
      if (x === null) return null;
      if (x === true) return 1;
      if (x === false) return 0;
      if (typeof x === 'string') {
        // at least zero
        return Number.parseInt('0' + x.trim());
      }
      if (typeof x === 'number') {
        return Math.trunc(x);
      }

      throw new Error('unsupported value for toString: ' + x);
    })
    .with('to_float', () => {
      const x = intExpr(expr.args[0], ctx);
      if (x === null) return null;
      if (x === true) return 1;
      if (x === false) return 0;
      if (typeof x === 'string') {
        // at least zero
        return Number.parseFloat('0' + x.trim());
      }
      if (typeof x === 'number') {
        return x;
      }

      throw new Error('unsupported value for toString: ' + x);
    })
    .with('substring', () => {
      const target = intExpr(expr.args[0], ctx);
      const start = intExpr(expr.args[1], ctx);
      const end = intExpr(expr.args[2], ctx);

      assert(target === null || typeof target === 'string');

      assert(
        start === null || typeof start === 'number',
        'substring first argument must be a number'
      );

      assert(
        end === null || typeof end === 'number',
        'substring second argument must be a number or undefined'
      );

      if (target === null || start === null || end === null) {
        return null;
      }

      return (target as string).substring(start, end);
    })
    .exhaustive();
}

function nullish(x: unknown): boolean {
  return x === undefined || x === null;
}

function intLocator(expr: LocatorExpr<Dynamic>, ctx: IntContext): unknown {
  if (!ctx.scope.has(expr.root)) {
    throw new Error('can not find variable in scope');
  }
  let value = ctx.scope.get(expr.root);
  if (nullish(value)) {
    return null;
  }

  for (const path of expr.path) {
    for (const part of path) {
      if (typeof value !== 'object') {
        throw new Error('invalid locator path');
      }

      // safety: checked that value is an object
      value = (value as any)[part];

      if (nullish(value)) {
        return null;
      }
    }
  }

  return value;
}

function intSql(): unknown {
  throw new Error('sql interpretation is not supported');
}

function intQueryTerminator(
  expr: QueryTerminatorExpr<Dynamic>,
  ctx: IntContext
): unknown {
  const agg = (f: (items: unknown[]) => unknown) => {
    const nonNull = intQuery(expr.query, ctx).filter(x => !nullish(x));
    if (nonNull.length === 0) {
      return null;
    }

    return f(nonNull);
  };

  return match(expr.terminator)
    .with('size', () => intQuery(expr.query, ctx).length)
    .with('some', () => intQuery(expr.query, ctx).length > 0)
    .with('empty', () => intQuery(expr.query, ctx).length === 0)
    .with('first', () => {
      const result = intQuery(expr.query, ctx)[0] ?? null;
      if (Array.isArray(result)) {
        throw new Error(
          'invalid first query terminator result, arrays are not supported'
        );
      }

      if (
        !(result instanceof Date) &&
        result !== null &&
        typeof result === 'object'
      ) {
        throw new Error(
          'invalid first query terminator result, objects are not supported'
        );
      }

      return result;
    })
    .with('max', () =>
      agg(items => {
        const comparableItems = items.filter(
          (x): x is number | string =>
            typeof x === 'number' || typeof x === 'string'
        );
        if (comparableItems.length < items.length) {
          throw new Error(
            'max query terminator works only on numbers or strings'
          );
        }

        return comparableItems.sort((a, b) => (a > b ? -1 : 1))[0];
      })
    )
    .with('min', () =>
      agg(items => {
        const comparableItems = items.filter(
          (x): x is number | string =>
            typeof x === 'number' || typeof x === 'string'
        );
        if (comparableItems.length < items.length) {
          throw new Error(
            'min query terminator works only on numbers or strings'
          );
        }

        return comparableItems.sort((a, b) => (a > b ? 1 : -1))[0];
      })
    )
    .with('sum', () =>
      agg(items => {
        const numbers = items.filter((x): x is number => typeof x === 'number');
        if (numbers.length < items.length) {
          throw new Error('sum query terminator works only on numbers');
        }

        return numbers.reduce((a, b) => a + b);
      })
    )
    .with('mean', () =>
      agg(items => {
        const numbers = items.filter((x): x is number => typeof x === 'number');
        if (numbers.length < items.length) {
          throw new Error('mean query terminator works only on numbers');
        }

        return numbers.reduce((a, b) => a + b) / numbers.length;
      })
    )
    .exhaustive();
}
