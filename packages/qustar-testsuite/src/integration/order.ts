import {MapScalarFn, ScalarMapping} from 'qustar';
import {posts} from '../db.js';
import {SuiteContext} from '../describe.js';
import {Post} from '../utils.js';

export function describeOrder({
  describe,
  expectQuery,
  testFactory,
  test,
}: SuiteContext) {
  describe('query', () => {
    describe('order by', () => {
      const testOrderBy = testFactory(
        <Result extends ScalarMapping>(orderBy: MapScalarFn<Post, Result>) => {
          return posts
            .orderByAsc(orderBy)
            .limit(3)
            .select(x => x.title);
        }
      );

      testOrderBy('id', x => x.id, ['TypeScript', 'rust', 'C#']);
      testOrderBy('name', x => x.title, ['C#', 'C++', 'Python']);
      testOrderBy('author.name', x => x.author.name.concat(x.id.toString()), [
        'Ruby',
        'C++',
        'TypeScript',
      ]);

      test('user id asc post id desc', async () => {
        const query = posts
          .orderByAsc(x => x.author_id)
          .thenByDesc(x => x.id)
          .map(x => x.id);

        await expectQuery(query, [3, 2, 1, 5, 4, 6]);
      });

      test('user id desc post id asc', async () => {
        const query = posts
          .orderByDesc(x => x.author_id)
          .thenByAsc(x => x.id)
          .map(x => x.id);

        await expectQuery(query, [6, 4, 5, 1, 2, 3]);
      });

      test('order by select', async () => {
        const query = posts.map(x => x.comments.count()).orderByAsc(x => x);

        await expectQuery(query, [0, 0, 0, 0, 1, 3]);
      });
    });
  });
}
