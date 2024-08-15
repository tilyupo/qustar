import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderSqlite,
} from 'qustar';
import type {Database} from 'sqlite3';
import {loadSqlite3} from './load-sqlite3.js';
import {indent} from './utils.js';

export class Sqlite3Connector implements Connector {
  private readonly db: Promise<Database>;

  constructor(filename: string);
  constructor(db: Database);
  constructor(dbOrFilename: Database | string) {
    if (typeof dbOrFilename === 'string') {
      this.db = loadSqlite3().then(x => new x.Database(dbOrFilename));
    } else {
      this.db = Promise.resolve(dbOrFilename);
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  async execute(statement: string): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.exec(statement, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async select(command: SqlCommand): Promise<any[]> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.all(
        // we need to add proxy select to force SQLite to rename duplicate columns
        // otherwise node-sqlite3 will take the last column with the same name, but we expect
        // the first column to be taken
        `SELECT\n  node_sqlite3_proxy.*\nFROM\n  (\n${indent(command.src, 2)}\n  ) AS node_sqlite3_proxy`,
        ...command.args.map(convertToArgument),
        (err: any, rows: any[]) => {
          if (err) {
            err.message += '\n\n' + command.src;
            reject(err);
          } else {
            resolve(
              rows.map((x: any) => {
                const result: any = {};
                for (const key of Object.keys(x)) {
                  // SQLite uses :<num> for duplicates
                  if (key.indexOf(':') !== -1) continue;
                  result[key] = x[key];
                }
                return result;
              })
            );
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) =>
      db.close(err => {
        if (err) {
          reject(err);
        }
        resolve();
      })
    );
  }
}
