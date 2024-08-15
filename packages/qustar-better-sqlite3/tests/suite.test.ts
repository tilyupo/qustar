import * as Database from 'better-sqlite3';
import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, expect, test} from 'vitest';
import {BetterSqlite3Connector} from '../src/better-sqlite3-connector.js';

describeConnector(
  {test, describe, expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m)},
  {
    connector: new BetterSqlite3Connector(new Database(':memory:')),
    initSql: createInitSqlScript('sqlite'),
  },
  {fuzzing: false, lateralSupport: false}
);
