import Database from 'better-sqlite3';
import {describeConnector} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {BetterSqlite3Connector} from '../src/better-sqlite3.js';

describeConnector(
  {test, describe},
  new BetterSqlite3Connector(new Database(':memory:')),
  {fuzzing: false}
);
