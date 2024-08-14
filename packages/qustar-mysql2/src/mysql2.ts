import {Pool, RowDataPacket, createPool} from 'mysql2';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderMySql,
} from 'qustar';

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

  async execute(statement: string): Promise<void> {
    await this.db.promise().execute(statement);
  }

  async select(command: SqlCommand): Promise<any[]> {
    const [rows] = await this.db
      .promise()
      .query<RowDataPacket[]>(command.src, command.args.map(convertToArgument));

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
