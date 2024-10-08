import {mkdirSync, writeFileSync} from 'fs';
import {
  Connector,
  Query,
  QueryTerminatorExpr,
  SingleLiteralValue,
  compileQuery,
  interpretQuery,
  materialize,
  optimize,
  renderSqlite,
} from 'qustar';
import {Stmt} from 'qustar/dist/esm/src/query/query.js';
import {Comment, EXAMPLE_DB, Post, User} from './db.js';
import {TestApi} from './describe.js';
import {simpleExpectDeepEqual} from './expect.js';

export {Comment, Post, User};

function indent(s: string, depth = 1): string {
  return s
    .split('\n')
    .map(x => '  '.repeat(depth) + x)
    .join('\n');
}

export function queryToSql(query: Query<any> | QueryTerminatorExpr<any>) {
  const compiledQuery = compileQuery(query, {parameters: false});
  const optimizedQuery = optimize(compiledQuery);
  const renderedQuery = renderSqlite(optimizedQuery);

  return renderedQuery.sql;
}

export interface ExecuteOptions {
  readonly optOnly?: boolean;
  readonly rawOnly?: boolean;
  readonly debug?: boolean;
  readonly ignoreOrder?: boolean;
  readonly checkInterpret?: boolean;
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
    renderSqlite(compiledQuery).sql
  );

  const optimizedQuery = optimize(compiledQuery);
  writeFileSync(
    `./debug/${token}/sql-opt.json`,
    JSON.stringify(optimizedQuery, undefined, 2)
  );

  const renderedQuery = renderSqlite(optimizedQuery);
  writeFileSync(`./debug/${token}/query-opt.sql`, renderedQuery.sql);
  writeFileSync(
    `./debug/${token}/args.json`,
    JSON.stringify(renderedQuery.args, undefined, 2)
  );
}

export interface DescribeOrmUtils {
  execute<T>(
    query: Query<T> | QueryTerminatorExpr<any> | Stmt<any>,
    options?: ExecuteOptions
  ): Promise<T[]>;
  expectQuery<T>(
    query: Query<T> | QueryTerminatorExpr<T & SingleLiteralValue>,
    expected: any,
    options?: ExecuteOptions
  ): Promise<void>;
  test(name: string, f: () => Promise<void>, options?: ExecuteOptions): void;
  testFactory<Param, Result>(
    f: (
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
  testApi: TestApi,
  connector: Connector,
  migrationsApplied: Promise<void>
): DescribeOrmUtils {
  const test = testApi.test;
  const expectDeepEqual = testApi.expectDeepEqual ?? simpleExpectDeepEqual;
  async function checkProvider(
    query: Query<any> | QueryTerminatorExpr<any>,
    expectedRows: any[] | undefined,
    options?: ExecuteOptions
  ) {
    await migrationsApplied;
    if (!connector) {
      return;
    }

    if (options?.optOnly && options.rawOnly) {
      throw new Error(
        'invalid execute options: at least opt or raw must be allowed'
      );
    }

    const projection =
      query instanceof Query ? query.projection : query.projection();
    let sql = compileQuery(query, {parameters: false});
    if (options?.optOnly) {
      sql = optimize(sql);
    }
    const referenceCommand = connector.render(sql);
    const referenceRows = await connector
      .query(referenceCommand)
      .then((rows: any[]) => rows.map(x => materialize(x, projection)));

    if (options?.ignoreOrder) {
      canonSort(referenceRows);
    }

    if (expectedRows !== undefined) {
      expectDeepEqual(referenceRows, expectedRows);
    }

    for (const withOptimization of [true, false]) {
      if (options?.rawOnly && withOptimization) continue;
      if (options?.optOnly && !withOptimization) continue;

      for (const parameters of [true, false]) {
        let sql = compileQuery(query, {parameters});
        if (withOptimization) {
          sql = optimize(sql);
        }

        const command = connector.render(sql);
        const rows = await connector
          .query(command)
          .then((rows: any[]) => rows.map(x => materialize(x, projection)));

        if (options?.ignoreOrder) {
          canonSort(rows);
        }

        try {
          expectDeepEqual(rows, referenceRows);
        } catch (err: any) {
          err.message += '\n\nROWS MISSMATCH!';
          err.message += '\n\ncmd:';
          err.message +=
            '\n\n  rows: ' + indent(JSON.stringify(rows, null, 2)).trim();
          err.message += indent(
            '\nargs: ' + JSON.stringify(command.args) + '\n\n' + command.sql
          );

          err.message += '\n\nref:';
          err.message +=
            '\n\n  rows: ' +
            indent(JSON.stringify(referenceRows, null, 2)).trim();
          err.message += indent(
            '\nargs: ' +
              JSON.stringify(referenceCommand.args) +
              '\n\n' +
              referenceCommand.sql
          );
          throw err;
        }
      }
    }

    return referenceRows;
  }

  async function execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    options?: ExecuteOptions
  ): Promise<T[]> {
    const expectedRows =
      (options?.checkInterpret ?? false)
        ? query instanceof Query
          ? interpretQuery(query, {db: EXAMPLE_DB})
          : interpretQuery(query, {db: EXAMPLE_DB})
        : undefined;

    if (options?.ignoreOrder && expectedRows) {
      canonSort(expectedRows);
    }

    const result = await checkProvider(query, expectedRows, options);

    if (result === undefined && expectedRows === undefined) {
      throw new Error('must checkInterpret or have a provider');
    }

    return (expectedRows ?? result)!;
  }

  async function expectQuery(query, expected, options) {
    const rows = await execute(query, options);

    if (options?.debug) {
      dump(query);
    }

    if (options?.ignoreOrder) {
      canonSort(rows);
      canonSort(expected);
    }

    try {
      expectDeepEqual(rows, expected);
    } catch (err: any) {
      err.message += '\n\n' + queryToSql(query);
      throw err;
    }
  }

  return {
    execute,
    expectQuery,
    test(name, f) {
      test(name, async () => {
        await f();
      });
    },
    testFactory(f) {
      return (name, arg, expected, options) => {
        test(name, async () => {
          let queries = f(arg);
          if (!Array.isArray(queries)) {
            queries = [queries];
          }

          for (const query of queries) {
            await expectQuery(
              query,
              Array.isArray(expected) ? expected : [expected],
              options
            );
          }
        });
      };
    },
  };
}
