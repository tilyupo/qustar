import {describe, expect, test} from 'vitest';
import {Query} from '../src/query/query.js';
import {Q} from '../src/qustar.js';

expect.addSnapshotSerializer({
  test(val) {
    return typeof val === 'string' && val.startsWith('SELECT');
  },
  print(val) {
    return `${(val as string).trim()}`;
  },
});

describe('snapshot', () => {
  test('eq', () => {
    expect(
      Query.table({name: 'users', schema: {id: Q.i32()}})
        .filter(x => x.id.eq(1))
        .render('postgresql').sql
    ).toMatchInlineSnapshot(/* sql */ `
      SELECT
        "s1"."id"
      FROM
        users AS "s1"
      WHERE
        "s1"."id" = (0 + 1)
    `);
  });

  test('innerJoin', () => {
    const comments = Query.table({
      name: 'comments',
      schema: {parent_id: Q.i32().null(), id: Q.i32()},
    });
    expect(
      comments
        .join({
          type: 'inner',
          right: comments,
          select: (child, parent) => ({
            c: child.id,
            p: parent.id,
          }),
          condition: (child, parent) => child.parent_id.eq(parent.id),
        })
        .render('postgresql').sql
    ).toMatchInlineSnapshot(/* sql */ `
      SELECT
        "s1_1"."id" AS "p",
        "s1"."id" AS "c"
      FROM
        comments AS "s1"
        INNER JOIN comments AS "s1_1" ON "s1"."parent_id" = "s1_1"."id"
    `);
  });
});
