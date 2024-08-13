import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, expect, test} from 'vitest';
import {Mysql2Connector} from '../src/mysql2.js';

describeConnector(
  {test, describe, expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m)},
  {
    connector: new Mysql2Connector(
      'mysql://qustar:test@localhost:22784/qustar'
    ),
    initSql: createInitSqlScript('mysql'),
  },
  {fuzzing: false}
);
