import {Client, Pool} from 'pg';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderPostgreSql,
} from 'qustar';

export class PgConnector implements Connector {
  private readonly client: Client | Pool;

  constructor(connectionString: string);
  constructor(client: Client);
  constructor(pool: Pool);
  constructor(clientOrConnectionString: Client | Pool | string) {
    if (typeof clientOrConnectionString === 'string') {
      this.client = new Pool({
        connectionString: clientOrConnectionString,
      });
    } else {
      this.client = clientOrConnectionString;
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderPostgreSql(query);
  }

  execute(statement: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.query(statement, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async select(command: SqlCommand): Promise<any[]> {
    const {rows} = await this.client.query(
      command.src,
      command.args.map(convertToArgument)
    );

    return rows.map((x: any) => {
      const result: any = {};
      for (const key of Object.keys(x)) {
        // SQLite uses :<num> for duplicates
        if (key.indexOf(':') !== -1) continue;
        result[key] = x[key];
      }
      return result;
    });
  }
}
