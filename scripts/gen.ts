import {writeFileSync} from 'fs';
import {Database} from 'sqlite3';
import {materialize} from '../src/data-source';
import {Sqlite3DataSource} from '../src/data-sources/sqlite3';
import {EXAMPLE_SCHEMA_INIT_SQL} from '../src/example-schema';
import {CompilationError, compileQuery} from '../src/expr/compiler';
import {QueryTerminatorExpr} from '../src/expr/expr';
import {Query} from '../src/expr/query';
import {optimize} from '../src/sql/optimizer';

function init() {
  const db = new Database(':memory:');
  const provider = new Sqlite3DataSource(db);

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

      const rows = await provider.execute(renderedQuery);

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
    } catch (err) {
      if (err instanceof CompilationError) {
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
})();
