import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {Mysql2Connector} from '../src/mysql2.js';

describeConnector(
  {test, describe},
  {
    connector: new Mysql2Connector(
      'mysql://qustar:test@localhost:22784/qustar'
    ),
    initSql: createInitSqlScript('mysql'),
  },
  {fuzzing: false}
);
