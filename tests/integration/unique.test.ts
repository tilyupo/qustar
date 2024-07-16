import {describe} from 'vitest';
import {MapValueFn, Mapping} from '../../src/types';
import {Post, QuerySet, describeOrm} from '../utils';

describeOrm('query', async ({testFactory}) => {
  describe('unique', () => {
    const testUnique = testFactory(
      <T extends Mapping>({posts}: QuerySet, mapper: MapValueFn<Post, T>) => {
        return posts.select(mapper).unique();
      }
    );

    testUnique('id', x => x.id, [1, 2, 3, 4, 5, 6]);
    testUnique('id / 2', x => x.id.div(2), [0, 1, 2, 3]);
    testUnique('author name', x => x.author.name, ['Dima', 'Anna', 'Max']);
  });
});
