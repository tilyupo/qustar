import pg from 'pg';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderPostgreSql,
} from 'qustar';

export class PgConnector implements Connector {
  private readonly db: pg.Pool;

  constructor(connectionString: string);
  constructor(pool: pg.Pool);
  constructor(clientOrConnectionString: pg.Pool | string) {
    if (typeof clientOrConnectionString === 'string') {
      this.db = new pg.Pool({
        connectionString: clientOrConnectionString,
      });
    } else {
      this.db = clientOrConnectionString;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderPostgreSql(query);
  }

  async execute(statement: string): Promise<void> {
    await this.db.query(statement);
  }

  async select(command: SqlCommand): Promise<any[]> {
    const result = await this.db.query(
      command.src,
      command.args.map(convertToArgument)
    );

    return result.rows.map((x: any) => {
      const result: any = {};
      for (const key of Object.keys(x)) {
        result[key] = x[key];
      }
      return result;
    });
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}
