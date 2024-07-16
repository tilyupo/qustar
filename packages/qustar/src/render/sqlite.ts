import {SqlCommand} from '../data-source';
import {Sql} from '../sql/sql';
import {Mangler, renderSql} from './sql';

export function renderSqlite(sql: Sql): SqlCommand {
  return renderSql(sql, {
    emulateArrayLiteralParam: true,
    emulateXor: true,
    mangler: new SqliteManger(),
  });
}

export class SqliteManger implements Mangler {
  mangle(id: string): string {
    if (id.indexOf(':') !== -1) {
      throw new Error('can not use : in property names');
    }

    return `"${id.split('"').join('""')}"`;
  }
  unmangle(id: string): string {
    return id;
  }
}
