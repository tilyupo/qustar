import {SqlCommand} from '../connector.js';
import {Sql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderSqlite(sql: Sql): SqlCommand {
  return renderSql(sql, {
    float32Type: 'REAL',
    int32Type: 'INT',
    textType: 'TEXT',
    xor: '^',
    emulateBoolean: true,
    emulateArrayLiteralParam: true,
    emulateXor: true,
    escapeId(id: string): string {
      return `"${id.split('"').join('""')}"`;
    },
    placeholder: () => '?',
  });
}
