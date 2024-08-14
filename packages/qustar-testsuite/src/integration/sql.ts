import {Query, sql} from 'qustar';
import {SuiteContext} from '../describe.js';

export function describeSql({describe, expectQuery, test}: SuiteContext) {
  describe('query', () => {
    describe('sql', () => {
      test('SELECT 1 as value', async () => {
        const query = Query.raw({
          sql: sql`SELECT 1 as value`,
          schema: {
            value: 'i32',
          },
        });

        await expectQuery(query, [{value: 1}]);
      });

      test('row_number', async () => {
        const query = Query.raw({
          sql: sql`
            SELECT
              p.id,
              ROW_NUMBER () OVER (PARTITION BY p.author_id ORDER BY p.id) AS idx
            FROM
              posts AS p
            ORDER BY
              p.id
          `,
          schema: {
            id: 'i32',
            idx: 'i32',
          },
        }).map(x => ({...x, idx: x.idx.sub(1)}));

        await expectQuery(query, [
          {id: 1, idx: 0},
          {id: 2, idx: 1},
          {id: 3, idx: 2},
          {id: 4, idx: 0},
          {id: 5, idx: 1},
          {id: 6, idx: 0},
        ]);
      });

      test('subquery', async ({users}) => {
        const query = users
          .orderByAsc(x => x.id)
          .map(x =>
            Query.raw({
              sql: sql`SELECT * FROM posts as p WHERE p.author_id = ${x.id}`,
              schema: {
                id: 'i32',
              },
            }).sum(x => x.id)
          );

        await expectQuery(query, [6, 9, 6]);
      });

      test('schema', async ({users}) => {
        const query = Query.raw({
          sql: sql`SELECT * FROM posts`,
          schema: {
            author_id: {type: 'i32'},
            id: 'i32',
            author: {
              type: 'ref',
              required: true,
              references: () => users,
              condition: (post, user) => post.author_id.eq(user.id),
            },
          },
        })
          .orderByAsc(x => x.id)
          .map(x => x.author.id);

        await expectQuery(query, [1, 1, 1, 2, 2, 3]);
      });
    });
  });
}
