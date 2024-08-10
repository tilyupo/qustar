/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import pg from 'pg';
import {Query, compileQuery, optimize} from 'qustar';
import {PgConnector} from 'qustar-pg';
import {Sqlite3Connector} from 'qustar-sqlite3';
import {comments} from '../packages/qustar-testsuite/src/db.js';
import {EXAMPLE_SCHEMA_INIT_SQL} from './common/example-schema.js';

function init() {
  console.log('pg', pg);
  const connector = (true as any)
    ? new PgConnector('postgresql://qustar:test@localhost:22783')
    : new Sqlite3Connector(':memory:');

  connector.execute(EXAMPLE_SCHEMA_INIT_SQL);

  async function execute<T>(query: Query<T>, silent = false) {
    try {
      const compiledQuery = compileQuery(query, {withParameters: false});
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

      const rows = await query.execute(connector);

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
    const query = comments.map(x => x.author.name);

    await execute(query);
  } finally {
    await close();
  }
})();
