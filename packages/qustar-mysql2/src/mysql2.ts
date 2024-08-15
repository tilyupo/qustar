import {Pool, RowDataPacket, createPool} from 'mysql2';
import {Connector, QuerySql, SqlCommand, renderMySql} from 'qustar';

export class Mysql2Connector implements Connector {
  private readonly db: Pool;

  constructor(connectionString: string);
  constructor(pool: Pool);
  constructor(clientOrConnectionString: Pool | string) {
    if (typeof clientOrConnectionString === 'string') {
      this.db = createPool(clientOrConnectionString);
    } else {
      this.db = clientOrConnectionString;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderMySql(query);
  }

  async execute(sql: string): Promise<void> {
    await this.db.promise().execute(sql);
  }

  async query<T = any>(command: SqlCommand | string): Promise<T[]> {
    const {sql, args} = SqlCommand.derive(command);
    const [rows] = await this.db.promise().query<RowDataPacket[]>(sql, args);

    return rows.map((row: any) => {
      const result: any = {};
      for (const key of Object.keys(row)) {
        result[key] = row[key];
      }
      return result;
    });
  }

  async close(): Promise<void> {
    await this.db.promise().end();
  }
}
