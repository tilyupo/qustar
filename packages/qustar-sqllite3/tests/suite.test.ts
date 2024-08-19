import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import sqlite3 from 'sqlite3';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {Sqlite3Connector} from '../src/sqlite3-connector.js';

describeConnector(
  {
    test,
    describe,
    expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m),
    beforeEach,
    afterEach,
  },
  new Sqlite3Connector(new sqlite3.Database(':memory:')),
  createInitSqlScript('sqlite'),
  {fuzzing: false, lateralSupport: false}
);
