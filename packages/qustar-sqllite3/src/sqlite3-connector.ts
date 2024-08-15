import {Connector, QuerySql, SqlCommand, renderSqlite} from 'qustar';
import type {Database} from 'sqlite3';
import {loadSqlite3} from './load-sqlite3.js';

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

  async execute(sql: string): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.exec(sql, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async query<T = any>(command: SqlCommand | string): Promise<T[]> {
    const {sql, args} = SqlCommand.derive(command);
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.all(sql, ...args, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close(): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) =>
      db.close(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    );
  }
}
