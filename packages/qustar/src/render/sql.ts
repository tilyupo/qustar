import {match} from 'ts-pattern';
import {SqlCommand, cmd} from '../connector.js';
import {
  ArrayLiteral,
  Literal,
  LiteralValue,
  SingleLiteral,
  assertArrayLiteral,
  assertSingleLiteral,
  inferLiteral,
} from '../literal.js';
import {isNumeric} from '../query/expr.js';
import {
  AliasSql,
  BinarySql,
  CaseSql,
  CombinationSql,
  FuncSql,
  LiteralSql,
  LookupSql,
  QuerySql,
  RawSql,
  RowNumberSql,
  SelectSql,
  Sql,
  SqlOrderBy,
  UnarySql,
} from '../sql/sql.js';
import {indent} from '../utils.js';

class RenderingContext {
  private placeholderIndex = 0;

  constructor(readonly options: SqlRenderingOptions) {}

  placeholder(literal: Literal) {
    return this.options.placeholder(this.placeholderIndex++, literal);
  }

  escapeId(id: string): string {
    return this.options.escapeId(id);
  }
}

export interface SqlRenderingOptions {
  // this option is needed when two columns with the same name is selected
  // SQLite selects the first column with the same name
  // PostgreSQL selects the last
  // so we need to alter SQL generation to preserve intended behavior
  pretty?: boolean;
  emulateArrayLiteralParam?: boolean;
  castToIntAfterBitwiseNot?: boolean;
  emulateXor?: boolean;
  xor: '^' | '#' | (string & {});
  emulateBoolean?: boolean;
  escapeId: (id: string) => string;
  placeholder: (index: number, literal: Literal) => string;
  int32Type: 'INT' | 'SIGNED' | (string & {});
  float32Type: 'REAL' | 'FLOAT' | (string & {});
  textType: 'TEXT' | 'CHAR' | (string & {});
}

export function renderSql(
  sql: QuerySql,
  options: SqlRenderingOptions
): SqlCommand {
  return render(sql, new RenderingContext(options ?? {}));
}

function render(sql: Sql, ctx: RenderingContext): SqlCommand {
  return match(sql)
    .with({type: 'func'}, x => renderFunc(x, ctx))
    .with({type: 'alias'}, x => renderAlias(x, ctx))
    .with({type: 'binary'}, x => renderBinary(x, ctx))
    .with({type: 'case'}, x => renderCase(x, ctx))
    .with({type: 'combination'}, x => renderCombination(x, ctx))
    .with({type: 'literal'}, x => renderLiteral(x, ctx))
    .with({type: 'lookup'}, x => renderLookup(x, ctx))
    .with({type: 'select'}, x => renderSelect(x, ctx))
    .with({type: 'unary'}, x => renderUnary(x, ctx))
    .with({type: 'raw'}, x => renderRaw(x, ctx))
    .with({type: 'row_number'}, x => renderRowNumber(x, ctx))
    .exhaustive();
}

function renderFunc(sql: FuncSql, ctx: RenderingContext): SqlCommand {
  if (sql.func === 'to_int32') {
    return cmd`CAST(${render(sql.args[0], ctx)} as ${ctx.options.int32Type})`;
  } else if (sql.func === 'to_float32') {
    return cmd`CAST(${render(sql.args[0], ctx)} as ${ctx.options.float32Type})`;
  } else if (sql.func === 'to_string') {
    return cmd`CAST(${render(sql.args[0], ctx)} as ${ctx.options.textType})`;
  } else {
    const {fn, args} = match(sql.func)
      .with('substring', () => ({
        // substr(start, length)
        fn: 'substr',
        args: [
          render(sql.args[0], ctx),
          // start = input_start + 1 --  SQLite string indexing starts with 1, not 0
          render(
            {
              type: 'binary',
              op: '+',
              lhs: sql.args[1],
              rhs: {
                type: 'literal',
                literal: inferLiteral(1),
                parameter: false,
              },
            },
            ctx
          ),
          // end = input_end - input_start
          render(
            {
              type: 'binary',
              op: '-',
              lhs: sql.args[2],
              rhs: sql.args[1],
            },
            ctx
          ),
        ],
      }))
      .with('lower', () => ({
        fn: 'LOWER',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('upper', () => ({
        fn: 'UPPER',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('avg', () => ({fn: 'AVG', args: sql.args.map(x => render(x, ctx))}))
      .with('count', () => ({
        fn: 'COUNT',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('max', () => ({fn: 'MAX', args: sql.args.map(x => render(x, ctx))}))
      .with('min', () => ({fn: 'MIN', args: sql.args.map(x => render(x, ctx))}))
      .with('sum', () => ({fn: 'SUM', args: sql.args.map(x => render(x, ctx))}))
      .with('coalesce', () => ({
        fn: 'COALESCE',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('concat', () => ({
        fn: 'concat',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .with('length', () => ({
        fn: 'length',
        args: sql.args.map(x => render(x, ctx)),
      }))
      .exhaustive();

    return cmd`${fn}(${SqlCommand.join(args, ', ')})`;
  }
}

function renderAlias(sql: AliasSql, ctx: RenderingContext): SqlCommand {
  return {
    sql: ctx.escapeId(sql.name),
    args: [],
  };
}

function renderWrap(sql: Sql, ctx: RenderingContext): SqlCommand {
  const result = render(sql, ctx);
  if (
    sql.type === 'lookup' ||
    sql.type === 'alias' ||
    sql.type === 'unary' ||
    sql.type === 'func' ||
    sql.type === 'literal' ||
    sql.type === 'case'
  ) {
    return result;
  }

  return cmd`(${result})`;
}

function renderBinary(sql: BinarySql, ctx: RenderingContext): SqlCommand {
  const lhs = renderWrap(sql.lhs, ctx);
  const rhs = renderWrap(sql.rhs, ctx);

  if (sql.op === '^' && ctx.options.emulateXor) {
    return cmd`(~(${lhs}&${rhs}))&(${lhs}|${rhs})`;
  }

  const op = match(sql.op)
    .with('and', () => 'AND')
    .with('or', () => 'OR')
    .with('!=', () => '!=')
    .with('<', () => '<')
    .with('<=', () => '<=')
    .with('==', () => '=')
    .with('>', () => '>')
    .with('>=', () => '>=')
    .with('in', () => 'IN')
    .with('like', () => 'LIKE')
    .with('*', () => '*')
    .with('+', () => '+')
    .with('-', () => '-')
    .with('/', () => '/')
    .with('%', () => '%')
    .with('|', () => '|')
    .with('&', () => '&')
    .with('^', () => ctx.options.xor)
    .with('<<', () => '<<')
    .with('>>', () => '>>')
    .exhaustive();

  return cmd`${lhs} ${op} ${rhs}`;
}

function renderUnary(sql: UnarySql, ctx: RenderingContext): SqlCommand {
  const [prefix, op] = match(sql.op)
    .with('!', () => [true, 'NOT'] as const)
    .with('+', () => [true, '+'] as const)
    .with('-', () => [true, '-'] as const)
    .with('~', () => [true, '~'] as const)
    .with('exists', () => [true, 'EXISTS'] as const)
    .with('not_exists', () => [true, 'NOT EXISTS'] as const)
    .with('is_not_null', () => [false, 'IS NOT NULL'] as const)
    .with('is_null', () => [false, 'IS NULL'] as const)
    .exhaustive();

  const inner = renderWrap(sql.inner, ctx);

  let result = prefix ? cmd`${op} ${inner}` : cmd`${inner} ${op}`;

  if (sql.op === '~' && ctx.options.castToIntAfterBitwiseNot) {
    result = cmd`CAST(${result} as ${ctx.options.int32Type})`;
  }

  return result;
}

function renderRaw(sql: RawSql, ctx: RenderingContext): SqlCommand {
  const src = [sql.src[0]];
  const args: LiteralValue[] = [];

  for (let i = 1; i < sql.src.length; i += 1) {
    const arg = render(sql.args[i - 1], ctx);
    args.push(...arg.args);
    src.push(`(${arg.sql})`);
    src.push(sql.src[i]);
  }

  return {
    sql: src.join(''),
    args,
  };
}

function renderRowNumber(sql: RowNumberSql, ctx: RenderingContext): SqlCommand {
  return sql.orderBy === undefined
    ? cmd`ROW_NUMBER() OVER ()`
    : cmd`ROW_NUMBER() OVER (ORDER BY ${renderOrderByTerms(sql.orderBy, ctx)})`;
}

function renderCase(sql: CaseSql, ctx: RenderingContext): SqlCommand {
  const subject = renderWrap(sql.subject, ctx);

  const whens: SqlCommand[] = [];
  for (const when of sql.whens) {
    const condition = renderWrap(when.condition, ctx);
    const result = renderWrap(when.result, ctx);

    whens.push(cmd`WHEN ${condition} THEN ${result}`);
  }

  // we must render fallback after everything above, because we use positional
  // arguments for PostgreSQL
  const fallback = renderWrap(sql.fallback, ctx);

  return cmd`CASE ${subject} ${SqlCommand.join(whens, ' ')} ELSE ${fallback} END`;
}

function renderCombination(
  sql: CombinationSql,
  ctx: RenderingContext
): SqlCommand {
  const op = match(sql)
    .with({combType: 'union'}, () => 'UNION')
    .with({combType: 'union_all'}, () => 'UNION\nALL')
    .with({combType: 'intersect'}, () => 'INTERSECT')
    .with({combType: 'except'}, () => 'EXCEPT')
    .exhaustive();

  return cmd`${render(sql.lhs, ctx)}\n${op}\n${render(sql.rhs, ctx)}`;
}

function renderSingleLiteralInline(
  literal: SingleLiteral,
  ctx: RenderingContext
): SqlCommand {
  const command = match(literal)
    .with({type: {type: 'boolean'}}, ({value}) =>
      ctx.options.emulateBoolean
        ? cmd`${value ? '1' : '0'}`
        : cmd`${value ? 'true' : 'false'}`
    )
    .with({type: {type: 'f32'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'f64'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i8'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i16'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i32'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'i64'}}, ({value}) => cmd`${value}`)
    .with({type: {type: 'null'}}, () => cmd`NULL`)
    .with(
      {type: {type: 'text'}},
      ({value}) => cmd`'${value.split("'").join("''")}'`
    )
    .exhaustive();

  if (
    (isNumeric(literal.type) ||
      (literal.type.type === 'boolean' && ctx.options.emulateBoolean)) &&
    literal.type.type !== 'null'
  ) {
    // we need to add plus to make sure that DB treats it as an expression
    // by default it will treat numbers as column indexes in GROUP/ORDER BY context
    return cmd`(0 + ${command})`;
  } else {
    return cmd`${command}`;
  }
}

function renderSingleLiteral(
  literal: SingleLiteral,
  parameter: boolean,
  ctx: RenderingContext
): SqlCommand {
  if (parameter) {
    return {
      args: [literal.value],
      sql: ctx.placeholder(literal),
    };
  } else {
    return renderSingleLiteralInline(literal, ctx);
  }
}

function renderArrayLiteral(
  literal: ArrayLiteral,
  parameter: boolean,
  ctx: RenderingContext
): SqlCommand {
  if (ctx.options.emulateArrayLiteralParam) {
    const literalQueries = literal.value.map(x =>
      renderSingleLiteral(
        {
          type: literal.type.itemType,
          value: x,
        } as SingleLiteral,
        parameter,
        ctx
      )
    );

    return cmd`(${SqlCommand.join(literalQueries, ', ')})`;
  }

  return {
    args: [literal.value],
    sql: ctx.placeholder(literal),
  };
}

function renderLiteral(
  {literal, parameter}: LiteralSql,
  ctx: RenderingContext
): SqlCommand {
  if (literal.type.type === 'array') {
    // for type check

    assertArrayLiteral(literal);

    return renderArrayLiteral(literal, parameter, ctx);
  } else {
    // for type check
    assertSingleLiteral(literal);

    return renderSingleLiteral(literal, parameter, ctx);
  }
}

function renderLookup(sql: LookupSql, ctx: RenderingContext): SqlCommand {
  return cmd`${render(sql.subject, ctx)}.${ctx.escapeId(sql.prop)}`;
}

function indentCommand(
  command: SqlCommand,
  depth: number,
  ctx: RenderingContext
): SqlCommand {
  if (ctx.options.pretty === false) {
    return command;
  }
  return {
    sql: indent(command.sql, depth),
    args: command.args,
  };
}

function straight(command: SqlCommand): SqlCommand {
  return {
    ...command,
    sql: command.sql
      .split('\n')
      .map(x => x.trim())
      .join(' '),
  };
}

function renderSelect(sql: SelectSql, ctx: RenderingContext): SqlCommand {
  const columns = SqlCommand.join(
    sql.columns.map((column): SqlCommand => {
      let expr = straight(render(column.expr, ctx));

      if (
        column.expr.type === 'select' ||
        column.expr.type === 'combination' ||
        column.expr.type === 'raw'
      ) {
        // todo: it seems like it must be:
        // expr = cmd`(${expr}) AS ${ctx.escapeId(column.as)}`;
        expr = cmd`(${expr})`;
      }

      if (column.expr.type === 'lookup' && column.expr.prop === column.as) {
        return cmd`${expr}`;
      } else {
        return cmd`${expr} AS ${ctx.escapeId(column.as)}`;
      }
    }),
    ',\n'
  );
  let select = sql.distinct
    ? cmd`SELECT DISTINCT\n${indentCommand(columns, 1, ctx)}`
    : cmd`SELECT\n${indentCommand(columns, 1, ctx)}`;

  if (sql.from) {
    const from = match(sql.from)
      .with(
        {type: 'query'},
        ({query: queryIR, as: alias}) =>
          cmd`FROM\n  (\n${indentCommand(render(queryIR, ctx), 2, ctx)}\n  ) AS ${ctx.escapeId(alias)}`
      )
      .with(
        {type: 'table'},
        ({table, as: alias}) => cmd`FROM\n  ${table} AS ${ctx.escapeId(alias)}`
      )
      .with(
        {type: 'sql'},
        sql =>
          cmd`FROM\n  (\n${indentCommand(renderRaw(sql.sql, ctx), 2, ctx)}\n  ) AS ${ctx.escapeId(sql.as)}`
      )
      .exhaustive();

    select = cmd`${select}\n${from}`;
  }

  for (const join of sql.joins) {
    let joinType = match(join.type)
      .with('left', () => 'LEFT')
      .with('right', () => 'RIGHT')
      .with('inner', () => 'INNER')
      .exhaustive();

    joinType += ' JOIN';

    if (join.lateral) {
      joinType += ' LATERAL';
    }

    const right = match(join.right)
      .with(
        {type: 'query'},
        right => cmd`(\n${indentCommand(render(right.query, ctx), 2, ctx)}\n  )`
      )
      .with({type: 'table'}, right => cmd`${right.table}`)
      .with(
        {type: 'sql'},
        right =>
          cmd`(\n${indentCommand(renderRaw(right.sql, ctx), 2, ctx)}\n  )`
      )
      .exhaustive();

    select = cmd`${select}\n  ${joinType} ${right} AS ${ctx.escapeId(join.right.as)}`;
    if (join.condition) {
      select = cmd`${select} ON ${straight(render(join.condition, ctx))}`;
    }
  }

  if (sql.where !== undefined) {
    select = cmd`${select}\nWHERE\n  ${straight(render(sql.where, ctx))}`;
  }

  if (sql.groupBy !== undefined) {
    const groupByExpr = SqlCommand.join(
      sql.groupBy.map(expr => render(expr, ctx)),
      ', '
    );
    select = cmd`${select}\nGROUP BY ${straight(groupByExpr)}`;
  }

  if (sql.having !== undefined) {
    select = cmd`${select}\nHAVING ${straight(render(sql.having, ctx))}`;
  }

  if (sql.orderBy !== undefined) {
    select = cmd`${select}\nORDER BY\n  ${renderOrderByTerms(sql.orderBy, ctx)}`;
  }

  if (sql.limit !== undefined) {
    select = cmd`${select}\nLIMIT\n  ${sql.limit}`;
  }

  if (sql.offset !== undefined) {
    select = cmd`${select} OFFSET ${sql.offset}`;
  }

  return cmd`${select}`;
}

function renderOrderByTerms(
  terms: readonly SqlOrderBy[],
  ctx: RenderingContext
): SqlCommand {
  const parts = terms.map(part => {
    const orderByType = match(part.type)
      .with('asc', () => 'ASC')
      .with('desc', () => 'DESC')
      .exhaustive();

    return cmd`(${straight(render(part.expr, ctx))}) ${orderByType}`;
  });

  return SqlCommand.join(parts, ',\n  ');
}
