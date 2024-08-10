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
      Query.table({name: 'users', schema: {id: 'i32'}})
        .filter(x => x.id.eq(1))
        .renderInline('sqlite')
    ).toMatchInlineSnapshot(/* sql */ `
      SELECT
        "s1"."id"
      FROM
        users AS "s1"
      WHERE
        "s1"."id" = (0 + 1)
    `);
  });

  test('fullJoin', () => {
    // todo: improve optimizer
    const comments = Query.table({
      name: 'comments',
      schema: {parent_id: {type: 'i32', nullable: true}, id: 'i32'},
    });
    expect(
      comments
        .join({
          type: 'full',
          right: comments,
          select: (child, parent) => ({
            c: child.id,
            p: parent.id,
          }),
          condition: (child, parent) => child.parent_id.eq(parent.id),
        })
        .renderInline('sqlite')
    ).toMatchInlineSnapshot(`
      SELECT
        "s2"."id" AS "p",
        "s3"."id" AS "c"
      FROM
        (
          SELECT
            "s1"."parent_id",
            "s1"."id"
          FROM
            comments AS "s1"
        ) AS "s3"
        FULL JOIN (
          SELECT
            "s1"."parent_id",
            "s1"."id"
          FROM
            comments AS "s1"
        ) AS "s2" ON "s3"."parent_id" = "s2"."id"
    `);
  });
});
