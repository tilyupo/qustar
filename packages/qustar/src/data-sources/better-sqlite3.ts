import {Database as BetterSqliteDb} from 'better-sqlite3';
import {DataSource, SqlCommand} from '../data-source.js';
import {convertToArgument} from '../render/sql.js';
import {renderSqlite} from '../render/sqlite.js';
import {QuerySql} from '../sql/sql.js';

export class BetterSqlite3DataSource implements DataSource {
  constructor(private readonly db: BetterSqliteDb) {}

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }

  execute(statement: string): Promise<void> {
    this.db.exec(statement);

    return Promise.resolve();
  }

  select({src: sql, args}: SqlCommand): Promise<any[]> {
    const preparedQuery = this.db.prepare(sql);
    const result = preparedQuery
      .all(...args.map(convertToArgument))
      .map((x: any) => {
        const result: any = {};
        for (const key of Object.keys(x)) {
          result[key] = x[key];
        }
        return result;
      });

    return Promise.resolve(result);
  }
}
