import {match} from 'ts-pattern';
import {
  SCALAR_COLUMN_ALIAS,
  SYSTEM_COLUMN_PREFIX,
  deserializePropPath,
} from './expr/compiler.js';
import {Projection, PropPath} from './expr/projection.js';
import {Literal} from './literal.js';
import {QuerySql} from './sql/sql.js';
import {arrayEqual, deepEntries, setPath} from './utils.js';

export interface SqlCommand {
  readonly src: string;
  readonly args: Literal[];
}

export namespace SqlCommand {
  export function join(queries: SqlCommand[], sep = ''): SqlCommand {
    return {
      src: queries.map(x => x.src).join(sep),
      args: queries.flatMap(x => x.args),
    };
  }
}

export interface Connector {
  render(query: QuerySql): SqlCommand;
  select(query: SqlCommand): Promise<any[]>;
  execute(statement: string): Promise<void>;
  close(): Promise<void>;
}

interface FlatRowColumn {
  path: PropPath;
  value: any;
}

type FlatRow = FlatRowColumn[];

function createSlice(row: FlatRow, prefix: string) {
  const slice: FlatRow = [];

  for (const {path, value} of row) {
    if (path[0] === prefix) {
      slice.push({path: path.slice(1), value});
    }
  }

  return slice;
}

function flatRowToObject(row: FlatRow): unknown {
  const result: any = {};

  const props = new Set(row.map(({path}) => path[0]));

  for (const prop of props) {
    const slice = createSlice(row, prop);
    if (
      slice.findIndex(({path}) => path.length === 0) !== -1 &&
      slice.length > 1
    ) {
      throw new Error('invalid FlatRow: ' + JSON.stringify(row, null, 2));
    }

    if (slice.length === 1 && slice[0].path.length === 0) {
      result[prop] = slice[0].value;
    } else {
      result[prop] = flatRowToObject(slice);
    }
  }

  return result;
}

export function materialize(row: any, projection: Projection): any {
  for (const key of Object.keys(row)) {
    if (key.startsWith(SYSTEM_COLUMN_PREFIX)) {
      delete row[key];
    }
  }

  // todo: combine with deep entries?
  row = flatRowToObject(
    Object.entries(row).map(
      ([prop, value]): FlatRowColumn => ({
        path: deserializePropPath(prop),
        value,
      })
    )
  );

  function materializeBoolean(value: unknown, nullable: boolean) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value !== null && value !== 0 && value !== 1) {
      throw new Error('can not materialize boolean value: ' + value);
    }

    if (value === null) {
      if (nullable) {
        return null;
      } else {
        throw new Error('got null for a non null boolean');
      }
    } else {
      return value === 1;
    }
  }

  return match(projection)
    .with({type: 'scalar'}, scalar => {
      const value = row[SCALAR_COLUMN_ALIAS];
      if (scalar.scalarType.type === 'boolean') {
        return materializeBoolean(value, scalar.scalarType.nullable);
      }

      return value;
    })
    .with({type: 'object'}, object => {
      const result: Record<string, any> = {};
      for (const [path, value] of deepEntries(row)) {
        const propProj = object.props.find(
          x => x.type === 'single' && arrayEqual(x.path, path)
        );
        if (
          propProj?.type === 'single' &&
          propProj.scalarType.type === 'boolean'
        ) {
          setPath(
            result,
            path,
            materializeBoolean(value, propProj.scalarType.nullable)
          );
        } else {
          setPath(result, path, value);
        }
      }

      return result;
    })
    .exhaustive();
}

export function cmd(
  template: TemplateStringsArray,
  ...expr: Array<SqlCommand | string | number>
): SqlCommand {
  const parts: string[] = [template[0]];
  const args: Literal[] = [];

  for (let i = 1; i < template.length; i += 1) {
    const currentExpr = expr[i - 1];
    if (typeof currentExpr === 'number' || typeof currentExpr === 'string') {
      parts.push(currentExpr.toString());
    } else {
      parts.push(currentExpr.src);
      args.push(...currentExpr.args);
    }
    parts.push(template[i]);
  }

  return {
    src: parts.join(''),
    args,
  };
}
