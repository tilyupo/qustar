import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {Mysql2Connector} from '../src/mysql2.js';

describeConnector(
  {
    test,
    describe,
    expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m),
    beforeEach,
    afterEach,
  },
  new Mysql2Connector('mysql://qustar:test@localhost:22784/qustar'),
  createInitSqlScript('mysql'),
  {fuzzing: false}
);
