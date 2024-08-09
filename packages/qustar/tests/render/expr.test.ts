import {describe, expect, test} from 'vitest';
import {Query} from '../../src/expr/query.js';

expect.addSnapshotSerializer({
  test(val) {
    return typeof val === 'string' && val.startsWith('SELECT');
  },
  print(val) {
    return `${(val as string).trim()}`;
  },
});

describe('expr', () => {
  test('eq', () => {
    expect(
      Query.table('users')
        .filter(x => x.id.eq(1))
        .renderInline('sqlite')
    ).toMatchInlineSnapshot(/* sql */ `
      SELECT
        s1.*
      FROM
        users AS "s1"
      WHERE
        "s1"."id" == (0 + 1)
    `);
  });
});
