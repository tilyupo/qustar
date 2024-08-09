/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import {
  Query,
  QueryTerminatorExpr,
  compileQuery,
  materialize,
  optimize,
} from 'qustar';
import {Sqlite3Connector} from 'qustar-sqlite3';
import sqlite3 from 'sqlite3';
import {EXAMPLE_SCHEMA_INIT_SQL} from './example-schema.js';

function init() {
  const db = new sqlite3.Database(':memory:');
  const provider = new Sqlite3Connector(db);

  db.exec(EXAMPLE_SCHEMA_INIT_SQL);

  async function execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    silent = false
  ) {
    try {
      const compiledQuery = compileQuery(query, {withParameters: false});
      const optimizedQuery = optimize(compiledQuery);
      const renderedQuery = provider.render(optimizedQuery);

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
          provider.render(compiledQuery).src
        );
        writeFileSync(
          './debug/query-opt.sql',
          provider.render(optimizedQuery).src
        );
        writeFileSync(
          './debug/args.json',
          JSON.stringify(renderedQuery.args, undefined, 2)
        );
      }

      const rows = await provider.select(renderedQuery);

      if (!silent) {
        console.log(renderedQuery.src);
        console.log();
      }

      if (!silent) {
        for (const row of rows) {
          console.log(
            materialize(
              row,
              query instanceof Query ? query.projection : query.projection()
            )
          );
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

  return {execute};
}

(async () => {
  const {execute} = init();

  const users = await Query.table('users').map(x =>
    Query.sql`SELECT * FROM posts as p WHERE p.author_id = ${x.id}`.first(
      x => x.id
    )
  );

  const result = execute(users);
  console.log(result);
})();
