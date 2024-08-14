import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderSqlite,
} from 'qustar';
import sqlite3 from 'sqlite3';
import {indent} from './utils.js';

export class Sqlite3Connector implements Connector {
  private readonly db: sqlite3.Database;

  constructor(filename: string);
  constructor(db: sqlite3.Database);
  constructor(dbOrFilename: sqlite3.Database | string) {
    if (typeof dbOrFilename === 'string') {
      this.db = new sqlite3.Database(dbOrFilename);
    } else {
      this.db = dbOrFilename;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  execute(statement: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(statement, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  select(command: SqlCommand): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
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

  close(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }
}
