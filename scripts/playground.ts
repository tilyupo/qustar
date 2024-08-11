/* eslint-disable n/no-unpublished-import */
/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import {Query, QueryTerminatorExpr, compileQuery, optimize} from 'qustar';
import {PgConnector} from 'qustar-pg';
import {Sqlite3Connector} from 'qustar-sqlite3';
import {BetterSqlite3Connector} from '../packages/qustar-better-sqllite3/src/better-sqlite3.js';
import {Mysql2Connector} from '../packages/qustar-mysql2/src/mysql2.js';
import {
  createInitSqlScript,
  users,
} from '../packages/qustar-testsuite/src/db.js';

interface ExecOptions {
  readonly silent?: boolean;
  readonly noOpt?: boolean;
}

function connect(connector: string) {
  if (connector === 'mysql2') {
    return new Mysql2Connector('mysql://qustar:test@localhost:22784/qustar');
  } else if (connector === 'pg') {
    return new PgConnector('postgresql://qustar:test@localhost:22783');
  } else if (connector === 'sqlite3') {
    return new Sqlite3Connector(':memory:');
  } else if (connector === 'better-sqlite3') {
    return new BetterSqlite3Connector(':memory:');
  } else {
    throw new Error('unknown connector: ' + connector);
  }
}

async function init(variant: string) {
  const connector = connect(variant);

  const initScripts = createInitSqlScript('mysql');

  console.log(initScripts.join('\n'));

  for (const script of initScripts) {
    await connector.execute(script);
  }

  async function execute<T>(
    query: Query<T> | QueryTerminatorExpr<any>,
    options?: ExecOptions
  ) {
    try {
      const compiledQuery = compileQuery(query, {parameters: true});
      writeFileSync(
        './debug/sql-raw.json',
        JSON.stringify(compiledQuery, undefined, 2)
      );
      const optimizedQuery = options?.noOpt
        ? compiledQuery
        : optimize(compiledQuery);
      const renderedQuery = connector.render(optimizedQuery);

      if (!options?.silent) {
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

      if (!options?.silent) {
        console.log(renderedQuery.src);
        console.log();
      }

      if (!options?.silent) {
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
  const {execute, close} = await init('mysql2');

  try {
    const query = users
      .flatMap(x => x.comments.map(x => ({id: x.id, deleted: x.deleted})))
      .orderByAsc(x => x.id)
      .map(x => x.deleted);

    await execute(query, {noOpt: false});
  } finally {
    await close();
  }
})();
