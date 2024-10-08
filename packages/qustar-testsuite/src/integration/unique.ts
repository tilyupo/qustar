import {MapValueFn, ScalarMapping} from 'qustar';
import {posts} from '../db.js';
import {SuiteContext} from '../describe.js';
import {Post} from '../utils.js';

export function describeUnique({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('unique', () => {
      const testUnique = testFactory(
        (mapper: MapValueFn<Post, ScalarMapping>) => {
          return posts
            .map(mapper)
            .unique()
            .orderByAsc(x => x);
        }
      );

      testUnique('id', x => x.id, [1, 2, 3, 4, 5, 6] as any);
      testUnique('id / 2', x => x.id.div(2).toInt(), [0, 1, 2, 3] as any);
      testUnique('author name', x => x.author.name, [
        'Anna',
        'Dima',
        'Max',
      ] as any);
    });
  });
}
