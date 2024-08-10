import {SqlCommand} from '../connector.js';
import {QuerySql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderSqlite(sql: QuerySql): SqlCommand {
  return renderSql(sql, {
    falseInlineLiteral: '0',
    trueInlineLiteral: '1',
    emulateArrayLiteralParam: true,
    emulateXor: true,
    escapeId(id: string): string {
      if (id.indexOf(':') !== -1) {
        throw new Error('can not use : in property names');
      }

      return `"${id.split('"').join('""')}"`;
    },
    placeholder: () => '?',
  });
}
