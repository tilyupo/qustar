import {match} from 'ts-pattern';
import {SqlCommand} from '../connector.js';
import {ScalarType} from '../literal.js';
import {Sql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderPostgresql(sql: Sql): SqlCommand {
  return renderSql(sql, {
    float32Type: 'REAL',
    int32Type: 'INT',
    textType: 'TEXT',
    xor: '#',
    emulateArrayLiteralParam: true,
    escapeId(id: string): string {
      return `"${id.split('"').join('""')}"`;
    },
    placeholder: (idx, literal) => {
      const type = toPostgreSqlType(literal.type);
      if (type) {
        return `$${idx + 1}::${type}`;
      } else {
        return `$${idx + 1}`;
      }
    },
  });
}

function toPostgreSqlType(type: ScalarType): string | undefined {
  return match(type)
    .with({type: 'i8'}, () => 'smallint')
    .with({type: 'i16'}, () => 'smallint')
    .with({type: 'i32'}, () => 'integer')
    .with({type: 'i64'}, () => 'bigint')
    .with({type: 'boolean'}, () => 'boolean')
    .with({type: 'array'}, ({itemType}) => {
      const type = toPostgreSqlType(itemType);
      if (type) {
        return type + '[]';
      } else {
        return undefined;
      }
    })
    .with({type: 'f32'}, () => 'real')
    .with({type: 'f64'}, () => 'double precision')
    .with({type: 'string'}, () => 'string')
    .with({type: 'null'}, () => undefined)
    .exhaustive();
}
