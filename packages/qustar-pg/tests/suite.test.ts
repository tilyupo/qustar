import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {PgConnector} from '../src/pg-connector.js';

describeConnector(
  {
    test,
    describe,
    expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m),
    beforeEach,
    afterEach,
  },
  new PgConnector('postgresql://qustar:test@localhost:22783'),
  createInitSqlScript('postgresql').join(''),
  {fuzzing: false}
);
