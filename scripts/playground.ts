/* eslint-disable n/no-unpublished-import */
/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import pg from 'pg';
import {Query, QueryTerminatorExpr, compileQuery, optimize} from 'qustar';
import {PgConnector} from 'qustar-pg';
import {Sqlite3Connector} from 'qustar-sqlite3';
import {posts} from '../packages/qustar-testsuite/src/db.js';
import {EXAMPLE_SCHEMA_INIT_SQL} from './common/example-schema.js';

import {interpretQuery, materialize, renderSqlite} from 'qustar';
import {
  EXAMPLE_DB,
  comments,
  users,
} from '../packages/qustar-testsuite/src/db.js';

console.log({
  Query,
  compileQuery,
  interpretQuery,
  materialize,
  optimize,
  renderSqlite,
  EXAMPLE_DB,
  comments,
  posts,
  users,
});

function init() {
  console.log('pg', pg);
  const connector = (true as any)
    ? new PgConnector('postgresql://qustar:test@localhost:22783')
    : new Sqlite3Connector(':memory:');

  connector.execute(EXAMPLE_SCHEMA_INIT_SQL);

  async function execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    silent = false
  ) {
    try {
      const compiledQuery = compileQuery(query, {parameters: true});
      const optimizedQuery = optimize(compiledQuery);
      const renderedQuery = connector.render(optimizedQuery);

      if (!silent) {
        writeFileSync(
          './debug/sql-raw.json',
          JSON.stringify(compiledQuery, undefined, 2)
        );
        writeFileSync(
          './debug/sql-opt.json',
          JSON.stringify(optimizedQuery, undefined, 2)
        );

        writeFileSync(
          './debug/query-raw.sql',
          connector.render(compiledQuery).src
        );
        writeFileSync(
          './debug/query-opt.sql',
          connector.render(optimizedQuery).src
        );
        writeFileSync(
          './debug/args.json',
          JSON.stringify(renderedQuery.args, undefined, 2)
        );
      }

      const rows = await connector.select(renderedQuery);

      if (!silent) {
        console.log(renderedQuery.src);
        console.log();
      }

      if (!silent) {
        for (const row of rows) {
          console.log(row);
        }

        console.log();
      }
    } catch (err: any) {
      if (err.sql && err.joins) {
        writeFileSync(
          './debug/sql.json',
          JSON.stringify(err.sql, undefined, 2)
        );
        writeFileSync(
          './debug/joins.json',
          JSON.stringify(err.joins, undefined, 2)
        );
      }

      throw err;
    }
  }

  return {execute, close: () => connector.close()};
}

(async () => {
  const {execute, close} = init();

  try {
    const query = posts.map(x => ({
      new_id: x.id.mul(3),
      text: x.title.concat(' ').concat(x.author.name),
    }));

    await execute(query);
  } finally {
    await close();
  }
})();
