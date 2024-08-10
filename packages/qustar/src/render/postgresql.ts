import {SqlCommand} from '../connector.js';
import {QuerySql} from '../sql/sql.js';
import {renderSql} from './sql.js';

export function renderPostgreSql(sql: QuerySql): SqlCommand {
  return renderSql(sql, {
    trueInlineLiteral: 'true',
    falseInlineLiteral: 'false',
    escapeId(id: string): string {
      if (id.indexOf(':') !== -1) {
        throw new Error('can not use : in property names');
      }

      return `"${id.split('"').join('""')}"`;
    },
    placeholder: idx => `$${idx + 1}`,
  });
}
