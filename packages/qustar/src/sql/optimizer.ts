import {match} from 'ts-pattern';
import {aggregationFuncs, SYSTEM_COLUMN_PREFIX} from '../expr/compiler.js';
import {assert, assertNever, compose} from '../utils.js';
import {ID_SQL_MAPPER, mapQuery, mapSelect, mapSql} from './mapper.js';
import {
  BinarySql,
  falseLiteral,
  LookupSql,
  QuerySql,
  SelectSql,
  SelectSqlColumn,
  Sql,
  trueLiteral,
} from './sql.js';

export function optimize(sql: QuerySql): QuerySql {
  let result = mapQuery(sql, {
    ...ID_SQL_MAPPER,
    select: compose(optimizeSelectFrom, optimizeSelectJoins, optimizeFilters),
    binary: optimizeLogicalBinaryTrivial,
  });
  // we need to remove lateral after join optimizations above
  result = mapQuery(result, {
    ...ID_SQL_MAPPER,
    join: x =>
      x.right.type === 'table' && x.lateral ? {...x, lateral: false} : x,
  });

  if (result.type === 'select') {
    return {
      ...result,
      // we don't need system columns in the final result
      columns: result.columns.filter(
        x => x.type === 'wildcard' || !x.as.startsWith(SYSTEM_COLUMN_PREFIX)
      ),
    };
  } else {
    return result;
  }
}

function optimizeLogicalBinaryTrivial(sql: BinarySql): Sql {
  if (sql.op === 'and') {
    if (sql.lhs.type === 'literal' && !sql.lhs.parameter) {
      if (sql.lhs.literal.value === true) {
        return sql.rhs;
      } else if (sql.lhs.literal.value === false) {
        return falseLiteral;
      }
    }

    if (sql.rhs.type === 'literal' && !sql.rhs.parameter) {
      if (sql.rhs.literal.value === true) {
        return sql.lhs;
      } else if (sql.rhs.literal.value === false) {
        return falseLiteral;
      }
    }
  } else if (sql.op === 'or') {
    if (sql.lhs.type === 'literal' && !sql.lhs.parameter) {
      if (sql.lhs.literal.value === true) {
        return trueLiteral;
      } else if (sql.lhs.literal.value === false) {
        return sql.rhs;
      }
    }

    if (sql.rhs.type === 'literal' && !sql.rhs.parameter) {
      if (sql.rhs.literal.value === true) {
        return trueLiteral;
      } else if (sql.rhs.literal.value === false) {
        return sql.lhs;
      }
    }
  }
  return sql;
}

function removeCoalesceToFalse(sql: Sql): Sql {
  if (sql.type === 'binary' && (sql.op === 'and' || sql.op === 'or')) {
    return {
      type: 'binary',
      op: sql.op,
      lhs: removeCoalesceToFalse(sql.lhs),
      rhs: removeCoalesceToFalse(sql.rhs),
    };
  } else if (
    sql.type === 'func' &&
    sql.func === 'coalesce' &&
    sql.args.length === 2 &&
    sql.args[1].type === 'literal' &&
    sql.args[1].parameter === false &&
    sql.args[1].literal.value === false
  ) {
    return sql.args[0];
  } else {
    return sql;
  }
}

function optimizeFilters(sql: SelectSql): SelectSql {
  return {
    columns: sql.columns,
    distinct: sql.distinct,
    from: sql.from,
    groupBy: sql.groupBy,
    having: sql.having && removeCoalesceToFalse(sql.having),
    where: sql.where && removeCoalesceToFalse(sql.where),
    limit: sql.limit,
    offset: sql.offset,
    type: sql.type,
    orderBy: sql.orderBy?.map(x => ({
      type: x.type,
      nulls: x.nulls,
      expr: x.expr,
    })),
    joins: sql.joins.map(x => ({
      type: x.type,
      lateral: x.lateral,
      condition: x.condition && removeCoalesceToFalse(x.condition),
      right: x.right,
    })),
  };
}

function mergeable(outer: SelectSql, inner: SelectSql): boolean {
  return (
    inner.distinct === undefined &&
    inner.limit === undefined &&
    inner.offset === undefined &&
    inner.groupBy === undefined &&
    outer.groupBy === undefined &&
    inner.columns.slice(0, -1).findIndex(x => x.type === 'wildcard') === -1 &&
    outer.joins.every(x => x.type === 'inner') &&
    inner.joins.every(x => x.type === 'inner') &&
    // don't merge if has aggregate function
    // example: SELECT SUM(x) FROM (SELECT (SELECT 1) x) y;
    (outer.columns.every(column => {
      if (column.type === 'wildcard') return true;

      let hasAggFunc = false;

      mapSql(column.expr, {
        ...ID_SQL_MAPPER,
        func: x => {
          if (aggregationFuncs.some(aggFunc => aggFunc === x.func)) {
            hasAggFunc = true;
          }
          return x;
        },
      });

      return !hasAggFunc;
    }) ||
      inner.columns.every(column => {
        if (column.type === 'wildcard') return true;

        let hasSelect = false;

        mapSql(column.expr, {
          ...ID_SQL_MAPPER,
          select: x => {
            hasSelect = true;
            return x;
          },
        });

        return !hasSelect;
      }))
  );
}

function combineConditions(
  a: Sql | undefined,
  b: Sql | undefined
): Sql | undefined {
  if (!a) {
    return b;
  }

  if (!b) {
    return a;
  }

  return {
    type: 'binary',
    op: 'and',
    lhs: a,
    rhs: b,
  };
}

function remapLookupRefs(
  lookup: LookupSql,
  target: SelectSql,
  targetAlias: string
): Sql {
  if (lookup.subject.type === 'alias' && lookup.subject.name === targetAlias) {
    const innerColumn = target.columns.find(
      x => x.type === 'wildcard' || x.as === lookup.prop
    );

    if (innerColumn === undefined) {
      throw new Error('Invalid SQL, can not find column in source');
    }

    if (innerColumn.type === 'wildcard') {
      return {
        type: 'lookup',
        subject: {
          type: 'alias',
          name: innerColumn.subject.name,
        },
        prop: lookup.prop,
      };
    } else if (innerColumn.type === 'single') {
      return innerColumn.expr;
    } else {
      return assertNever(innerColumn, 'invalid innerColumn: ' + innerColumn);
    }
  }

  return lookup;
}

function remapColumnRefs(
  column: SelectSqlColumn,
  target: SelectSql,
  targetAlias: string
): SelectSqlColumn | readonly SelectSqlColumn[] {
  if (column.type === 'wildcard' && column.subject.name === targetAlias) {
    return target.columns;
  }

  return column;
}

function remapRefs(
  referee: SelectSql,
  target: SelectSql,
  targetAlias: string
): SelectSql {
  return mapSelect(referee, {
    ...ID_SQL_MAPPER,
    lookup: lookup => remapLookupRefs(lookup, target, targetAlias),
    column: column => remapColumnRefs(column, target, targetAlias),
  });
}

function liftFrom(outer: SelectSql, inner: SelectSql): SelectSql {
  if (outer.from === undefined) return outer;
  if (!mergeable(outer, inner)) return outer;

  // remap access to inner through alias
  outer = remapRefs(outer, inner, outer.from.as);

  return {
    ...combineSelects(outer, inner, 'inner_joins_first'),
    from: inner.from,
  };
}

function combineSelects(
  outer: SelectSql,
  inner: SelectSql,
  joins: 'outer_joins_first' | 'inner_joins_first'
): SelectSql {
  return {
    type: 'select',
    columns: outer.columns,
    distinct: outer.distinct,
    from: outer.from,
    // inner joins must go first, because outer joins might depend on them
    joins: match(joins)
      .with('outer_joins_first', () => [...outer.joins, ...inner.joins])
      .with('inner_joins_first', () => [...inner.joins, ...outer.joins])
      .exhaustive(),
    where: combineConditions(outer.where, inner.where),
    groupBy: undefined,
    having: undefined,
    limit: outer.limit,
    offset: outer.offset,
    orderBy: outer.orderBy,
  };
}

function liftJoin(outer: SelectSql, joinIndex: number): SelectSql {
  assert(joinIndex < outer.joins.length, 'invalid join index for optimization');

  let join = outer.joins[joinIndex];
  if (
    join.right.type !== 'query' ||
    join.right.query.type !== 'select' ||
    join.right.query.from === undefined
  ) {
    return outer;
  }

  if (!mergeable(outer, join.right.query)) return outer;

  // before lifting inner query we must remap its aliases to prevent collisions
  // with outer scope

  outer = {
    ...outer,
    joins: [
      ...outer.joins.slice(0, joinIndex),
      {
        ...join,
        right: {
          ...join.right,
          query: remapAliases(join.right.query, extractDefinedAliases(outer)),
        },
      },
      ...outer.joins.slice(joinIndex + 1),
    ],
  };
  join = outer.joins[joinIndex];
  assert(
    join.right.type === 'query' &&
      join.right.query.type === 'select' &&
      join.right.query.from !== undefined &&
      joinIndex < outer.joins.length,
    'invalid alias remap'
  );

  // lift inner join query

  outer = remapRefs(outer, join.right.query, join.right.as);
  join = outer.joins[joinIndex];
  assert(
    join.right.type === 'query' &&
      join.right.query.type === 'select' &&
      join.right.query.from !== undefined &&
      joinIndex < outer.joins.length,
    'invalid refs remap'
  );

  const combined = combineSelects(outer, join.right.query, 'outer_joins_first');

  return {
    ...combined,
    joins: [
      ...combined.joins.slice(0, joinIndex),
      {
        type: join.type,
        condition: join.condition,
        lateral: join.lateral,
        right: join.right.query.from,
      },
      ...combined.joins.slice(joinIndex + 1),
    ],
  };
}

function optimizeSelectFrom(outer: SelectSql): SelectSql {
  if (outer.from?.type !== 'query' || outer.from.query.type !== 'select') {
    return outer;
  }

  const inner = outer.from.query;

  return liftFrom(outer, inner);
}

function optimizeSelectJoins(outer: SelectSql): SelectSql {
  let result = outer;

  // lift join adds lifted joins to the end of outer join list, so we can iterate
  // over original joins to lift them all up
  // joins of the join subquery are already lifted,
  // because mapSql is called on children first
  for (let i = 0; i < outer.joins.length; i += 1) {
    result = liftJoin(result, i);
  }

  return result;
}

function extractDefinedAliases(sql: Sql): Set<string> {
  const result: Set<string> = new Set();

  mapSql(sql, {
    ...ID_SQL_MAPPER,
    source: source => {
      result.add(source.as);
      return source;
    },
  });

  return result;
}

function remapAliases(sql: SelectSql, usedAliases: Set<string>): SelectSql {
  let aliasCounter = 1;
  function newAlias(source: string) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const alias = `${source}_${aliasCounter}`;
      aliasCounter += 1;
      if (!usedAliases.has(alias)) {
        usedAliases.add(alias);
        return alias;
      }
    }
  }

  for (const from of extractDefinedAliases(sql)) {
    const to = newAlias(from);
    sql = mapSelect(sql, {
      ...ID_SQL_MAPPER,
      alias: alias => (alias.name === from ? {type: 'alias', name: to} : alias),
      source: source => (source.as === from ? {...source, as: to} : source),
    });
  }

  return sql;
}
