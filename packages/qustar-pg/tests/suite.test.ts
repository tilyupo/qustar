import {describeConnector} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {PgConnector} from '../src/pg.js';

describeConnector(
  {test, describe},
  new PgConnector('postgresql://qustar:test@localhost:22783'),
  {fuzzing: false}
);
