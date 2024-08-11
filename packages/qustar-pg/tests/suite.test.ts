import {createInitSqlScript, describeConnector} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {PgConnector} from '../src/pg.js';

describeConnector(
  {test, describe},
  {
    connector: new PgConnector('postgresql://qustar:test@localhost:22783'),
    initSql: createInitSqlScript('postgresql').join(''),
  },
  {fuzzing: false}
);
