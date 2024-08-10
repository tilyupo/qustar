/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import pg from 'pg';
import {Query, QueryTerminatorExpr, compileQuery} from 'qustar';
import {PgConnector} from 'qustar-pg';
import {Sqlite3Connector} from 'qustar-sqlite3';
import {EXAMPLE_SCHEMA_INIT_SQL} from './common/example-schema.js';

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
      const compiledQuery = compileQuery(query, {parameters: false});
      const optimizedQuery = compiledQuery; // optimize(compiledQuery);
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
    const query = Query.sql`
    SELECT
      p.id,
      ROW_NUMBER () OVER (PARTITION BY p.author_id ORDER BY p.id) AS idx
    FROM
      posts AS p
    ORDER BY
      p.id
  `
      .schema({
        id: 'i32',
        idx: 'i32',
      })
      .map(x => ({...x, idx: x.idx.sub(1)}));

    await execute(query);
  } finally {
    await close();
  }
})();
