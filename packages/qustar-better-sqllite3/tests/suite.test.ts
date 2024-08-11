import Database from 'better-sqlite3';
import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {BetterSqlite3Connector} from '../src/better-sqlite3.js';

describeConnector(
  {test, describe},
  {
    connector: new BetterSqlite3Connector(new Database(':memory:')),
    initSql: createInitSqlScript('sqlite'),
  },
  {fuzzing: false, lateralSupport: false}
);
