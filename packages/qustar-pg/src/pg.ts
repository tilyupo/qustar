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

  execute(statement: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.query(statement, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async select(command: SqlCommand): Promise<any[]> {
    const {rows} = await this.db.query(
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

  close(): Promise<void> {
    return this.db.end();
  }
}
