import {SuiteContext} from '..';
import {FilterFn} from '../../../qustar/src/types';
import {Post} from '../utils';

export function describeFilter({
  describe,
  test,
  expectQuery,
  testFactory,
}: SuiteContext) {
  describe('query', () => {
    describe('filter by', () => {
      const testFilter = testFactory(({posts}, filter: FilterFn<Post>) => {
        return posts
          .filter(filter)
          .orderByAsc(x => x.id)
          .map(x => x.title)
          .limit(3);
      });

      testFilter('true', () => true, ['TypeScript', 'rust', 'C#']);
      testFilter('false', () => false, []);
      testFilter('expression', x => x.id.lte(2), ['TypeScript', 'rust']);
      testFilter('author name', x => x.author.name.eq('Dima'), [
        'TypeScript',
        'rust',
        'C#',
      ]);
      testFilter('author id', x => x.author.id.eq(2), ['Ruby', 'C++']);
      testFilter(
        'author comments count',
        x => x.author.comments.count().eq(1),
        ['Ruby', 'C++', 'Python']
      );

      test("comment parent text != 'never'", async ({comments}) => {
        const query = comments
          .filter(x => x.parent.text.ne('never'))
          .map(x => x.id);

        await expectQuery(query, [5, 6, 7, 8]);
      });
    });
  });
}
