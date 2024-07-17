import {describeDataSource} from 'qustar-testsuite';
import sqlite3 from 'sqlite3';
import {describe, test} from 'vitest';
import {Sqlite3DataSource} from '../src/sqlite3.js';

describeDataSource(
  {test, describe},
  new Sqlite3DataSource(new sqlite3.Database(':memory:')),
  {fuzzing: false}
);
