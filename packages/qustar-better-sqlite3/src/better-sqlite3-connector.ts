import {Database, Options} from 'better-sqlite3';
import {Connector, QuerySql, SqlCommand, renderSqlite} from 'qustar';
import {loadBetterSqlite3} from './load-better-sqlite3.js';

export class BetterSqlite3Connector implements Connector {
  private readonly db: Promise<Database>;

  constructor(filename: string, options?: Options);
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

  async execute(sql: string): Promise<void> {
    (await this.db).exec(sql);

    return Promise.resolve();
  }

  async query<T = any>(command: SqlCommand | string): Promise<T[]> {
    const {sql, args} = SqlCommand.derive(command);
    const preparedQuery = (await this.db).prepare(sql);
    const result = preparedQuery
      .all(
        ...args.map(arg => {
          // better-sqlite3 doesn't support booleans
          if (arg === true) {
            return 1;
          } else if (arg === false) {
            return 0;
          } else if (typeof arg === 'number' && Number.isSafeInteger(arg)) {
            return BigInt(arg);
          } else {
            return arg;
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
