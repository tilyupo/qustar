import {Database as Sqlite3Db} from 'sqlite3';
import {DataSource, SqlCommand} from '../data-source';
import {convertToArgument} from '../render/sql';
import {SqliteManger, renderSqlite} from '../render/sqlite';
import {QuerySql} from '../sql/sql';
import {indent} from '../utils';

// vitest doesn't crash with segmentation error while using sqlite3
export class Sqlite3DataSource implements DataSource {
  private readonly mangler = new SqliteManger();

  constructor(private readonly db: Sqlite3Db) {}

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  execute({src: sql, args}: SqlCommand): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        // we need to add proxy select to force SQLite to rename duplicate columns
        // otherwise node-sqlite3 will take the last column with the same name, but we expect
        // the first column to be taken
        `SELECT\n  node_sqlite3_proxy.*\nFROM\n  (\n${indent(sql, 2)}\n  ) AS node_sqlite3_proxy`,
        ...args.map(convertToArgument),
        (err: any, rows: any[]) => {
          if (err) {
            err.message += '\n\n' + sql;
            reject(err);
          } else {
            resolve(
              rows.map((x: any) => {
                const result: any = {};
                for (const key of Object.keys(x)) {
                  // SQLite uses :<num> for duplicates
                  if (key.indexOf(':') !== -1) continue;
                  result[this.mangler.unmangle(key)] = x[key];
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
