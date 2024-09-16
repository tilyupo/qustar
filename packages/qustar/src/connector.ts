import {LiteralValue, ScalarType} from './literal.js';
import {
  SCALAR_COLUMN_ALIAS,
  SYSTEM_COLUMN_PREFIX,
  deserializePropPath,
} from './query/compiler.js';
import {isNumeric} from './query/expr.js';
import {Projection, PropPath} from './query/projection.js';
import {Sql} from './sql/sql.js';
import {
  arrayEqual,
  assert,
  deepEntries,
  isNumberString,
  setPath,
} from './utils.js';

export interface SqlCommand {
  readonly sql: string;
  readonly args: LiteralValue[];
}

export namespace SqlCommand {
  export function derive(command: SqlCommand | string): SqlCommand {
    if (typeof command === 'string') {
      return {
        sql: command,
        args: [],
      };
    } else {
      return command;
    }
  }

  export function join(queries: SqlCommand[], sep = ''): SqlCommand {
    return {
      sql: queries.map(x => x.sql).join(sep),
      args: queries.flatMap(x => x.args),
    };
  }
}

export interface Connector {
  render(query: Sql): SqlCommand;
  query<T = any>(command: SqlCommand | string): Promise<T[]>;
  execute(sql: string): Promise<void>;
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

export function materialize(row: any | null, projection: Projection): any {
  assert(row !== undefined, 'invalid row: ' + row);

  if (row === null) {
    if (projection.nullable) {
      return null;
    } else {
      throw new Error('got null for non-nullable row');
    }
  }

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

  function materializeBoolean(value: unknown) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value !== 0 && value !== 1) {
      throw new Error('can not materialize boolean value: ' + value);
    }

    return value === 1;
  }

  function materializeNumber(value: unknown) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string' || !isNumberString(value)) {
      throw new Error('can not materialize number value: ' + value);
    }

    return Number.parseFloat(value);
  }

  function materializeScalar(value: unknown, scalarType: ScalarType) {
    if (value === null) {
      if (scalarType.nullable) {
        return null;
      } else {
        throw new Error('got null for a non null scalar type');
      }
    }

    if (scalarType.type === 'boolean') {
      return materializeBoolean(value);
    }

    if (isNumeric(scalarType)) {
      return materializeNumber(value);
    }

    return value;
  }

  return projection.visit({
    scalar: scalar => {
      const value = row[SCALAR_COLUMN_ALIAS];

      return materializeScalar(value, scalar.scalarType);
    },
    object: object => {
      const result: Record<string, any> = {};
      for (const [path, value] of deepEntries(row)) {
        const propProj = object.props.find(x => arrayEqual(x.path, path));
        assert(propProj !== undefined, 'got an unknown prop path');
        setPath(result, path, materializeScalar(value, propProj.scalarType));
      }

      return result;
    },
  });
}

export function cmd(
  template: TemplateStringsArray,
  ...expr: Array<SqlCommand | string | number>
): SqlCommand {
  const parts: string[] = [template[0]];
  const args: LiteralValue[] = [];

  for (let i = 1; i < template.length; i += 1) {
    const currentExpr = expr[i - 1];
    if (typeof currentExpr === 'number' || typeof currentExpr === 'string') {
      parts.push(currentExpr.toString());
    } else {
      parts.push(currentExpr.sql);
      args.push(...currentExpr.args);
    }
    parts.push(template[i]);
  }

  return {
    sql: parts.join(''),
    args,
  };
}
