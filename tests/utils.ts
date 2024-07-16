import BetterSqlite3Database from 'better-sqlite3';
import {mkdirSync, writeFileSync} from 'fs';
import {Database as Sqlite3Database} from 'sqlite3';
import {describe, expect, test} from 'vitest';
import {materialize} from '../src/data-source';
import {BetterSqlite3DataSource} from '../src/data-sources/better-sqlite3';
import {Sqlite3DataSource} from '../src/data-sources/sqlite3';
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
} from '../src/example-schema';
import {compileQuery} from '../src/expr/compiler';
import {QueryTerminatorExpr} from '../src/expr/expr';
import {Query} from '../src/expr/query';
import {SingleLiteralValue} from '../src/literal';
import {renderSqlite} from '../src/render/sqlite';
import {optimize} from '../src/sql/optimizer';
import {indent, promisify} from '../src/utils';

export {Comment, Post, User, comments, posts, users};

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

async function initSqlite3(sql: string) {
  const db = new Sqlite3Database(':memory:');
  const provider = new Sqlite3DataSource(db);

  await promisify(db.exec.bind(db))(sql);

  return {provider};
}

function initBetterSqlite3(sql: string) {
  const db = new BetterSqlite3Database(':memory:');
  const provider = new BetterSqlite3DataSource(db);

  db.exec(sql);

  return {provider};
}

export async function init(type?: 'better-sqlite3' | 'sqlite3') {
  const sql = /*sql*/ `
    CREATE TABLE users (
      id INT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE posts (
      id INT NOT NULL,
      title TEXT NOT NULL,
      author_id INT NOT NULL
    );

    CREATE TABLE comments (
      id INT NOT NULL,
      text TEXT NOT NULL,
      post_id INT NOT NULL,
      commenter_id INT NOT NULL,
      deleted BIT NOT NULL,
      parent_id INT NULL
    );

    --

    INSERT INTO
      users
    VALUES
      (1, 'Dima'),
      (2, 'Anna'),
      (3, 'Max');

    INSERT INTO
      posts
    VALUES
      (1, 'TypeScript', 1),
      (2, 'rust', 1),
      (3, 'C#', 1),
      (4, 'Ruby', 2),
      (5, 'C++', 2),
      (6, 'Python', 3);

    INSERT INTO
      comments(id, text, post_id, commenter_id, deleted, parent_id)
    VALUES
      (5, 'cool', 1, 1, 0, NULL),
      (6, '+1', 1, 1, 0, 5),
      (7, 'me too', 1, 2, 0, NULL),
      (8, 'nah', 2, 3, 1, 5);
  `;

  if (type === 'better-sqlite3') {
    return initBetterSqlite3(sql);
  } else if (type === 'sqlite3') {
    return await initSqlite3(sql);
  } else {
    return initSqlite3(sql);
  }
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

export function describeOrm(
  name: string,
  fn: (utils: DescribeOrmUtils) => Promise<void>,
  options?: {gen: boolean}
) {
  const skip =
    (process.env.GEN && options?.gen !== true) ||
    (process.env.NON_GEN && options?.gen === true);

  let d: typeof describe.skip = describe;
  if (skip) {
    d = d.skip;
  }
  d(name, async () => {
    const {provider} = await init('sqlite3');

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
        .then(rows => rows.map(x => materialize(x, projection)));

      if (options?.ignoreOrder) {
        canonSort(referenceRows);
      }

      for (const withOptimization of options?.optOnly
        ? [true]
        : [true, false]) {
        for (const withParameters of [true, false]) {
          let sql = compileQuery(query, {withParameters});
          if (withOptimization) {
            sql = optimize(sql);
          }

          const command = renderSqlite(sql);
          const rows = await provider
            .execute(command)
            .then(rows => rows.map(x => materialize(x, projection)));

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

    await fn({
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
    });
  });
}
