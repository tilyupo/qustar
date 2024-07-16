import {Database as BetterSqliteDb} from 'better-sqlite3';
import {DataSource, SqlCommand} from '../data-source';
import {SqliteManger, renderSqlite} from '../render/sqlite';
import {QuerySql} from '../sql/sql';

export class BetterSqlite3DataSource implements DataSource {
  private readonly mangler = new SqliteManger();

  constructor(private readonly db: BetterSqliteDb) {}

  render(query: QuerySql): SqlCommand {
    return renderSqlite(query);
  }
  execute({src: sql, args}: SqlCommand): Promise<any[]> {
    const preparedQuery = this.db.prepare(sql);
    const result = preparedQuery
      .all(...args.map(x => x.value))
      .map((x: any) => {
        const result: any = {};
        for (const key of Object.keys(x)) {
          result[this.mangler.unmangle(key)] = x[key];
        }
        return result;
      });

    return Promise.resolve(result);
  }
}
