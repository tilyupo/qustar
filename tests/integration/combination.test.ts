import {describe} from 'vitest';
import {describeOrm} from '../utils';

describeOrm('query', async ({expectQuery, test}) => {
  describe('combination', () => {
    test('string combination', async ({posts, users}) => {
      const lhs = users.select(x => x.name);
      const rhs = posts.select(x => x.title);
      const query = lhs
        .combine({other: rhs, type: 'union_all'})
        .orderByAsc(x => x)
        .limit(3);

      await expectQuery(query, ['Anna', 'C#', 'C++']);
    });

    test('object combination', async ({posts, users}) => {
      const lhs = users.select(x => ({id: x.id, name: x.name}));
      const rhs = posts.select(x => ({id: x.id, name: x.title}));
      const query = lhs
        .combine({other: rhs, type: 'union_all'})
        .orderByAsc(x => x.name)
        .limit(3);

      await expectQuery(query, [
        {id: 2, name: 'Anna'},
        {id: 3, name: 'C#'},
        {id: 5, name: 'C++'},
      ]);
    });

    test('object combination', async ({posts, users}) => {
      const lhs = users.select(x => x.id).orderByAsc(x => x);
      const rhs = posts.select(x => x.id).orderByDesc(x => x);
      const query = lhs.concat(rhs);

      await expectQuery(query, [1, 2, 3, 6, 5, 4, 3, 2, 1]);
    });
  });
});
