import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderSqlite,
} from 'qustar';
import {Database as Sqlite3Db} from 'sqlite3';
import {indent} from './utils.js';

// vitest doesn't crash with segmentation error while using sqlite3
export class Sqlite3DataSource implements Connector {
  constructor(private readonly db: Sqlite3Db) {}

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
}
