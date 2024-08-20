import {posts, users} from '../db.js';
import {SuiteContext} from '../describe.js';

export function describeCombination({
  test,
  expectQuery,
  describe,
}: SuiteContext) {
  describe('query', async () => {
    describe('combination', () => {
      test('string union all', async () => {
        const lhs = users.map(x => x.name);
        const rhs = posts.map(x => x.title);
        const query = lhs
          .unionAll(rhs)
          .orderByAsc(x => x)
          .limit(3);

        await expectQuery(query, ['Anna', 'C#', 'C++']);
      });

      test('object union all', async () => {
        const lhs = users.map(x => ({id: x.id, name: x.name}));
        const rhs = posts.map(x => ({id: x.id, name: x.title}));
        const query = lhs
          .unionAll(rhs)
          .orderByAsc(x => x.name)
          .limit(3);

        await expectQuery(query, [
          {id: 2, name: 'Anna'},
          {id: 3, name: 'C#'},
          {id: 5, name: 'C++'},
        ]);
      });

      test('concat (asc, desc)', async () => {
        const lhs = users.map(x => x.id).orderByAsc(x => x);
        const rhs = posts.map(x => x.id).orderByDesc(x => x);
        const query = lhs.concat(rhs);

        await expectQuery(query, [1, 2, 3, 6, 5, 4, 3, 2, 1]);
      });

      test('concat (desc, asc)', async () => {
        const lhs = users.map(x => x.id).orderByDesc(x => x);
        const rhs = posts.map(x => x.id).orderByAsc(x => x);
        const query = lhs.concat(rhs);

        await expectQuery(query, [3, 2, 1, 1, 2, 3, 4, 5, 6]);
      });
    });
  });
}
