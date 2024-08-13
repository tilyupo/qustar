import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import sqlite3 from 'sqlite3';
import {describe, expect, test} from 'vitest';
import {Sqlite3Connector} from '../src/sqlite3.js';

describeConnector(
  {test, describe, expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m)},
  {
    connector: new Sqlite3Connector(new sqlite3.Database(':memory:')),
    initSql: createInitSqlScript('sqlite'),
  },
  {fuzzing: false, lateralSupport: false}
);
