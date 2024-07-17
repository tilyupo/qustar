import {SqlCommand} from '../data-source.js';
import {Sql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderSqlite(sql: Sql): SqlCommand {
  return renderSql(sql, {
    emulateArrayLiteralParam: true,
    emulateXor: true,
    escapeId(id: string): string {
      if (id.indexOf(':') !== -1) {
        throw new Error('can not use : in property names');
      }

      return `"${id.split('"').join('""')}"`;
    },
  });
}
