import Database from 'better-sqlite3';
import {describeDataSource} from 'qustar-testsuite';
import {describe, test} from 'vitest';
import {BetterSqlite3DataSource} from '../src/better-sqlite3.js';

describeDataSource(
  {test, describe},
  new BetterSqlite3DataSource(new Database(':memory:')),
  {fuzzing: false}
);
