import {Connector} from 'qustar';
import {describeCombination} from './integration/combination.js';
import {describeExpr} from './integration/expr.js';
import {describeFlatMap} from './integration/flat-map.js';
import {describeGroupBy} from './integration/group-by.js';
import {describeJoin} from './integration/join.js';
import {describeMap} from './integration/map.js';
import {describeOrder} from './integration/order.js';
import {describePagination} from './integration/pagination.js';
import {describeSql} from './integration/sql.js';
import {describeTerminator} from './integration/terminator.js';
import {describeUnique} from './integration/unique.js';
import {buildUtils, DescribeOrmUtils} from './utils.js';

export interface TestApi {
  test: (name: string, f: () => Promise<void> | void) => void;
  describe: (name: string, f: () => Promise<void> | void) => void;
  expectDeepEqual?: <T>(a: T, b: T, message?: string) => void;
}

export interface TestSuiteOptions {
  fuzzing: boolean;
  rawSql: boolean;
  lateralSupport: boolean;
}

export function describeConnectorInternal(
  api: TestApi,
  connOptions: {connector: Connector; initSql: string | string[]} | undefined,
  options: TestSuiteOptions
) {
  let migrationsApplied = Promise.resolve();
  if (connOptions) {
    migrationsApplied = (async () => {
      const scripts = Array.isArray(connOptions.initSql)
        ? connOptions.initSql
        : [connOptions.initSql];
      for (const script of scripts) {
        await connOptions.connector.execute(script);
      }
    })();
  }

  const ctx: SuiteContext = {
    ...buildUtils(api, connOptions?.connector, migrationsApplied),
    describe: api.describe,
    lateralSupport: options.lateralSupport,
  };

  describeCombination(ctx);
  describeExpr(ctx);
  describeFlatMap(ctx);
  describeGroupBy(ctx);
  describeJoin(ctx);
  describeMap(ctx);
  describeOrder(ctx);
  describePagination(ctx);
  describeTerminator(ctx);
  describeUnique(ctx);

  if (options.rawSql) {
    describeSql(ctx);
  }

  if (options.fuzzing) {
    // todo: add fuzzing
  }
}

export function describeConnector(
  api: TestApi,
  connOptions: {connector: Connector; initSql: string | string[]} | undefined,
  options: Partial<TestSuiteOptions>
) {
  describeConnectorInternal(api, connOptions, {
    fuzzing: true,
    rawSql: true,
    lateralSupport: options.lateralSupport ?? true,
    ...options,
  });
}

export interface SuiteContext extends DescribeOrmUtils {
  describe: (name: string, f: () => Promise<void> | void) => void;
  lateralSupport: boolean;
}
