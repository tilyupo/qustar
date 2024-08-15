import {Pool} from 'pg';
import {
  Connector,
  QuerySql,
  SqlCommand,
  convertToArgument,
  renderPostgreSql,
} from 'qustar';
import {loadPg} from './load-pg.js';

export class PgConnector implements Connector {
  private readonly db: Promise<Pool>;

  constructor(connectionString: string);
  constructor(pool: Pool);
  constructor(clientOrConnectionString: Pool | string) {
    if (typeof clientOrConnectionString === 'string') {
      this.db = loadPg().then(
        x =>
          new x.Pool({
            connectionString: clientOrConnectionString,
          })
      );
    } else {
      this.db = Promise.resolve(clientOrConnectionString);
    }
  }

  render(query: QuerySql): SqlCommand {
    return renderPostgreSql(query);
  }

  async execute(statement: string): Promise<void> {
    await (await this.db).query(statement);
  }

  async select(command: SqlCommand): Promise<any[]> {
    const {rows, fields} = await (
      await this.db
    ).query(command.src, command.args.map(convertToArgument));

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
          [
            /* int8 */ 20, /* int2 */ 21, /* int4 */ 23, /* float4 */ 700,
            /* float8 */ 701, /* bit */ 1560, /* numeric */ 1700,
          ].includes(field.dataTypeID) &&
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
    await (await this.db).end();
  }
}
