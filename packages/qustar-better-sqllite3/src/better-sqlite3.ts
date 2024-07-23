import BetterSqlite3, {
  Database as BetterSqliteDb,
  Options,
} from 'better-sqlite3';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderSqlite,
} from 'qustar';
import {indent} from './utils.js';

export class BetterSqlite3Connector implements Connector {
  private readonly db: BetterSqliteDb;

  constructor(filename?: string | Buffer, options?: Options);
  constructor(db: BetterSqliteDb);
  constructor(dbOrFilename: any, options?: Options) {
    if (typeof dbOrFilename === 'string' || dbOrFilename instanceof Buffer) {
      this.db = new BetterSqlite3(dbOrFilename, options);
    } else {
      this.db = dbOrFilename;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  execute(statement: string): Promise<void> {
    this.db.exec(statement);

    return Promise.resolve();
  }

  select({src: sql, args}: SqlCommand): Promise<any[]> {
    const preparedQuery = this.db.prepare(
      // we need to add proxy select to force SQLite to rename duplicate columns
      // otherwise node-sqlite3 will take the last column with the same name, but we expect
      // the first column to be taken
      `SELECT\n  node_sqlite3_proxy.*\nFROM\n  (\n${indent(sql, 2)}\n  ) AS node_sqlite3_proxy`
    );
    const result = preparedQuery
      .all(
        ...args.map(x => {
          // better-sqlite3 doesn't support booleans
          if (x.value === true) {
            return 1;
          } else if (x.value === false) {
            return 0;
          } else if (
            typeof x.value === 'number' &&
            Number.isSafeInteger(x.value)
          ) {
            return BigInt(x.value);
          } else {
            return convertToArgument(x);
          }
        })
      )
      .map((x: any) => {
        const result: any = {};
        for (const key of Object.keys(x)) {
          // SQLite uses :<num> for duplicates
          if (key.indexOf(':') !== -1) continue;
          result[key] = x[key];
        }
        return result;
      });

    return Promise.resolve(result);
  }
}
