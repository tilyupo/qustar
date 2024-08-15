import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, expect, test} from 'vitest';
import {PgConnector} from '../src/pg-connector.js';

describeConnector(
  {test, describe, expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m)},
  {
    connector: new PgConnector('postgresql://qustar:test@localhost:22783'),
    initSql: createInitSqlScript('postgresql').join(''),
  },
  {fuzzing: false}
);
