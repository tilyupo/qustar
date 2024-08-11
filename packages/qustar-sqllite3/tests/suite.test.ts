import {describeConnector} from 'qustar-testsuite';
import sqlite3 from 'sqlite3';
import {describe, test} from 'vitest';
import {Sqlite3Connector} from '../src/sqlite3.js';

describeConnector(
  {test, describe},
  new Sqlite3Connector(new sqlite3.Database(':memory:')),
  {fuzzing: false, lateralSupport: false}
);
