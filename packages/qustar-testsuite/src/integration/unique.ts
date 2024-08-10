import {Mapping, MapValueFn} from 'qustar';
import {SuiteContext} from '../describe.js';
import {Post, QuerySet} from '../utils.js';

export function describeUnique({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('unique', () => {
      const testUnique = testFactory(
        <T extends Mapping>({posts}: QuerySet, mapper: MapValueFn<Post, T>) => {
          debugger;
          return posts
            .select(mapper)
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
