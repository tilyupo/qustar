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
  beforeEach: (fn: () => Promise<void>) => void;
  afterEach: (fn: () => Promise<void>) => void;
  expectDeepEqual?: <T>(a: T, b: T, message?: string) => void;
}

export interface TestSuiteOptions {
  fuzzing: boolean;
  rawSql: boolean;
  lateralSupport: boolean;
}

export function describeConnectorInternal(
  api: TestApi,
  connector: Connector,
  initSql: string | string[],
  options: TestSuiteOptions
) {
  const migrationsApplied = (async () => {
    const scripts = Array.isArray(initSql) ? initSql : [initSql];
    for (const script of scripts) {
      await connector.execute(script);
    }
  })();

  const ctx: SuiteContext = {
    ...buildUtils(api, connector, migrationsApplied),
    describe: api.describe,
    lateralSupport: options.lateralSupport,
    connector,
    beforeEach: api.beforeEach,
    afterEach: api.afterEach,
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
  connector: Connector,
  initSql: string | string[],
  options: Partial<TestSuiteOptions>
) {
  describeConnectorInternal(api, connector, initSql, {
    fuzzing: true,
    rawSql: true,
    lateralSupport: options.lateralSupport ?? true,
    ...options,
  });
}

export interface SuiteContext extends DescribeOrmUtils {
  describe: (name: string, f: () => Promise<void> | void) => void;
  beforeEach: (fn: () => Promise<void>) => void;
  afterEach: (fn: () => Promise<void>) => void;
  lateralSupport: boolean;
  connector: Connector;
}
