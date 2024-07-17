import {mkdirSync, writeFileSync} from 'fs';
import {
  DataSource,
  Query,
  QueryTerminatorExpr,
  SingleLiteralValue,
  compileQuery,
  materialize,
  optimize,
  renderSqlite,
} from 'qustar';
import {expect} from 'vitest';
import {
  Comment,
  Post,
  User,
  comments,
  posts,
  staticComments,
  staticPosts,
  staticUsers,
  users,
} from './db.js';
import {TestApi} from './index.js';

export {Comment, Post, User};

function indent(s: string, depth = 1): string {
  return s
    .split('\n')
    .map(x => '  '.repeat(depth) + x)
    .join('\n');
}

export function queryToSql(query: Query<any> | QueryTerminatorExpr<any>) {
  const compiledQuery = compileQuery(query, {withParameters: false});
  const optimizedQuery = optimize(compiledQuery);
  const renderedQuery = renderSqlite(optimizedQuery);

  return renderedQuery.src;
}

export interface ExecuteOptions {
  readonly optOnly?: boolean;
  readonly debug?: boolean;
  readonly staticOnly?: boolean;
  readonly ignoreOrder?: boolean;
}

function canonSort<T>(arr: T[]) {
  arr.sort((a: any, b: any) => {
    const aKey = JSON.stringify(a);
    const bKey = JSON.stringify(b);

    if (aKey < bKey) {
      return -1;
    } else {
      return 1;
    }
  });
}

async function expectQuery<T>(
  execute: (
    query: Query<T> | QueryTerminatorExpr<T & SingleLiteralValue>,
    options?: ExecuteOptions
  ) => Promise<T[]>,
  query: Query<T> | QueryTerminatorExpr<T & SingleLiteralValue>,
  expected: any[],
  options?: ExecuteOptions
) {
  const rows = await execute(query, options);

  if (options?.debug) {
    dump(query);
  }

  if (options?.ignoreOrder) {
    canonSort(rows);
    canonSort(expected);
  }

  try {
    expect(rows).to.deep.equal(expected);
  } catch (err: any) {
    err.message += '\n\n' + queryToSql(query);
    throw err;
  }
}

export function dump(
  query: Query<any> | QueryTerminatorExpr<any>,
  token = 'dump'
) {
  token = `${token}-${new Date().getTime()}`;
  mkdirSync(`./debug/${token}`);
  const compiledQuery = compileQuery(query);
  writeFileSync(
    `./debug/${token}/sql-raw.json`,
    JSON.stringify(compiledQuery, undefined, 2)
  );
  writeFileSync(
    `./debug/${token}/query-raw.sql`,
    renderSqlite(compiledQuery).src
  );

  const optimizedQuery = optimize(compiledQuery);
  writeFileSync(
    `./debug/${token}/sql-opt.json`,
    JSON.stringify(optimizedQuery, undefined, 2)
  );

  const renderedQuery = renderSqlite(optimizedQuery);
  writeFileSync(`./debug/${token}/query-opt.sql`, renderedQuery.src);
  writeFileSync(
    `./debug/${token}/args.json`,
    JSON.stringify(renderedQuery.args, undefined, 2)
  );
}

export interface QuerySet {
  readonly users: Query<User>;
  readonly posts: Query<Post>;
  readonly comments: Query<Comment>;
}

export interface DescribeOrmUtils {
  execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    options?: ExecuteOptions
  ): Promise<T[]>;
  expectQuery<T>(
    query: Query<T> | QueryTerminatorExpr<T & SingleLiteralValue>,
    expected: any,
    options?: ExecuteOptions
  ): Promise<void>;
  test(
    name: string,
    f: (querySet: QuerySet) => Promise<void>,
    options?: ExecuteOptions
  ): void;
  testFactory<Param, Result>(
    f: (
      q: QuerySet,
      param: Param
    ) =>
      | Query<Result>
      | QueryTerminatorExpr<Result & SingleLiteralValue>
      | Array<Query<Result> | QueryTerminatorExpr<Result & SingleLiteralValue>>
  ): (
    name: string,
    arg: Param,
    expected: Result | Result[],
    options?: ExecuteOptions
  ) => void;
}

export function buildUtils(
  provider: DataSource,
  {test}: TestApi
): DescribeOrmUtils {
  async function execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    options?: ExecuteOptions
  ): Promise<T[]> {
    const projection =
      query instanceof Query ? query.projection : query.projection();
    let sql = compileQuery(query, {withParameters: false});
    if (options?.optOnly) {
      sql = optimize(sql);
    }
    const referenceCommand = renderSqlite(sql);
    const referenceRows = await provider
      .execute(referenceCommand)
      .then((rows: any[]) => rows.map(x => materialize(x, projection)));

    if (options?.ignoreOrder) {
      canonSort(referenceRows);
    }

    for (const withOptimization of options?.optOnly ? [true] : [true, false]) {
      for (const withParameters of [true, false]) {
        let sql = compileQuery(query, {withParameters});
        if (withOptimization) {
          sql = optimize(sql);
        }

        const command = renderSqlite(sql);
        const rows = await provider
          .execute(command)
          .then((rows: any[]) => rows.map(x => materialize(x, projection)));

        if (options?.ignoreOrder) {
          canonSort(rows);
        }

        try {
          expect(rows).to.deep.equal(referenceRows);
        } catch (err: any) {
          err.message += '\n\nROWS MISSMATCH!';
          err.message += '\n\ncmd:';
          err.message +=
            '\n\n  rows: ' + indent(JSON.stringify(rows, null, 2)).trim();
          err.message += indent(
            '\nargs: ' + JSON.stringify(command.args) + '\n\n' + command.src
          );

          err.message += '\n\nref:';
          err.message +=
            '\n\n  rows: ' +
            indent(JSON.stringify(referenceRows, null, 2)).trim();
          err.message += indent(
            '\nargs: ' +
              JSON.stringify(referenceCommand.args) +
              '\n\n' +
              referenceCommand.src
          );
          throw err;
        }
      }
    }

    return referenceRows;
  }

  const staticSources = [
    {
      posts: staticPosts,
      users: staticUsers,
      comments: staticComments,
    },
  ];

  const allSources = [...staticSources, {posts, users, comments}];

  return {
    execute,
    expectQuery(query, expected, options) {
      return expectQuery(execute, query, expected, options);
    },
    test(name, f, options) {
      test(name, async () => {
        const sources = options?.staticOnly ? staticSources : allSources;
        for (const source of sources) {
          await f(source);
        }
      });
    },
    testFactory(f) {
      return (name, arg, expected, options) => {
        const sources = options?.staticOnly ? staticSources : allSources;
        test(name, async () => {
          for (const source of sources) {
            let queries = f(source, arg);
            if (!Array.isArray(queries)) {
              queries = [queries];
            }

            for (const query of queries) {
              await expectQuery(
                execute,
                query,
                Array.isArray(expected) ? expected : [expected],
                options
              );
            }
          }
        });
      };
    },
  };
}
