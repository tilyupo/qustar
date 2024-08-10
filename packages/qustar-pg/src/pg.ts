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
    const {rows, fields} = await this.db.query(
      command.src,
      command.args.map(convertToArgument)
    );

    return rows.map((row: any) => {
      const result: any = {};
      for (const key of Object.keys(row)) {
        const field = fields.find(x => x.name === key);
        if (!field) {
          throw new Error(
            `can not parse result from pg: field ${key} not found`
          );
        }
        // pg returns some number types as strings to preserve accuracy
        // list of all dataTypeIDs can be found in the oid.txt file at the root
        if (
          [20, 21, 23, 700, 701, 1700].includes(field.dataTypeID) &&
          row[key] !== null
        ) {
          result[key] = Number.parseFloat(row[key]);
        } else {
          result[key] = row[key];
        }
      }
      return result;
    });
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}
