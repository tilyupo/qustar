import {SqlCommand} from '../connector.js';
import {Sql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderMysql(sql: Sql): SqlCommand {
  return renderSql(sql, {
    float32Type: 'FLOAT',
    int32Type: 'SIGNED',
    textType: 'CHAR',
    xor: '^',
    castToIntAfterBitwiseNot: true,
    emulateArrayLiteralParam: true,
    escapeId(id: string): string {
      return '`' + id.split('`').join('``') + '`';
    },
    placeholder: () => '?',
  });
}
