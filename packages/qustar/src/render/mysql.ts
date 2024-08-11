import {SqlCommand} from '../connector.js';
import {QuerySql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderMySql(sql: QuerySql): SqlCommand {
  return renderSql(sql, {
    float32Type: 'DECIMAL',
    int32Type: 'SIGNED',
    textType: 'CHAR',
    xor: '^',
    emulateArrayLiteralParam: true,
    escapeId(id: string): string {
      return '`' + id.split('`').join('``') + '`';
    },
    placeholder: () => '?',
  });
}
