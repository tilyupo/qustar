import {Database, Options} from 'better-sqlite3';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderSqlite,
} from 'qustar';
import {loadBetterSqlite3} from './load-better-sqlite3.js';
import {indent} from './utils.js';

export class BetterSqlite3Connector implements Connector {
  private readonly db: Promise<Database>;

  constructor(filename?: string, options?: Options);
  constructor(db: Database);
  constructor(dbOrFilename: any, options?: Options) {
    if (typeof dbOrFilename === 'string') {
      this.db = loadBetterSqlite3().then(x => x(dbOrFilename, options));
    } else {
      this.db = dbOrFilename;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  async execute(statement: string): Promise<void> {
    (await this.db).exec(statement);

    return Promise.resolve();
  }

  async select({src: sql, args}: SqlCommand): Promise<any[]> {
    const preparedQuery = (await this.db).prepare(
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

  async close(): Promise<void> {
    (await this.db).close();
    return Promise.resolve();
  }
}
