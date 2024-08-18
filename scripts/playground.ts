/* eslint-disable n/no-extraneous-import */
import {writeFileSync} from 'fs';
import {Query, QueryTerminatorExpr, compileQuery, optimize} from 'qustar';
import {BetterSqlite3Connector} from 'qustar-better-sqlite3';
import {PgConnector} from 'qustar-pg';
import {Sqlite3Connector} from 'qustar-sqlite3';
import {createInitSqlScript} from 'qustar-testsuite';
import {Mysql2Connector} from '../packages/qustar-mysql2/src/mysql2.js';

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

  const initScripts = createInitSqlScript('sqlite');

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
          connector.render(compiledQuery).sql
        );
        writeFileSync(
          './debug/query-opt.sql',
          connector.render(optimizedQuery).sql
        );
        writeFileSync(
          './debug/args.json',
          JSON.stringify(renderedQuery.args, undefined, 2)
        );
      }

      const rows = await connector.query(renderedQuery);

      if (!options?.silent) {
        console.log(renderedQuery.sql);
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

  return {execute, connector};
}

const {execute, connector: connector} = await init('sqlite3');

try {
  const users = Query.table({name: 'users', schema: {id: 'i32', name: 'text'}});

  await users
    .insert({id: 4, name: 'test'}, {id: 5, name: 'new'})
    .exec(connector);

  await execute(users, {noOpt: false});

  await users
    .filter(x => x.id.eq(1))
    .delete()
    .execute(connector);
  await execute(users, {noOpt: false});
  await users
    .filter(x => x.id.eq(3))
    .update(x => ({name: x.name.concat(' new name'), id: x.id.mul(10)}))
    .execute(connector);

  await execute(users, {noOpt: false});
} finally {
  await connector.close();
}
