import {Mapping, MapValueFn} from 'qustar';
import {SuiteContext} from '../index.js';
import {Post, QuerySet} from '../utils.js';

export function describeUnique({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('unique', () => {
      const testUnique = testFactory(
        <T extends Mapping>({posts}: QuerySet, mapper: MapValueFn<Post, T>) => {
          return posts.select(mapper).unique();
        }
      );

      testUnique('id', x => x.id, [1, 2, 3, 4, 5, 6] as any);
      testUnique('id / 2', x => x.id.div(2), [0, 1, 2, 3] as any);
      testUnique('author name', x => x.author.name, [
        'Dima',
        'Anna',
        'Max',
      ] as any);
    });
  });
}
