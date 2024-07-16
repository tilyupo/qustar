import {SuiteContext} from '..';
import {Query} from '../../../qustar/src';
import {Post} from '../utils';

export function describePagination({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('pagination [1, 2, 3, 4, 5, 6]', () => {
      const testPagination = testFactory(
        ({posts}, limits: [limit: number, offset: number | undefined][]) => {
          return limits
            .reduce(
              (q, [limit, offset]) => q.limit(limit, offset),
              posts.orderByAsc(x => x.id) as Query<Post>
            )
            .select(x => x.id);
        }
      );

      testPagination('(0, 0)', [[0, 0]], []);
      testPagination('(9, 0)', [[9, 0]], [1, 2, 3, 4, 5, 6]);
      testPagination('(9,  )', [[9, undefined]], [1, 2, 3, 4, 5, 6]);
      testPagination('(2,  )', [[2, undefined]], [1, 2]);
      testPagination('(3, 0)', [[3, 0]], [1, 2, 3]);
      testPagination('(3, 2)', [[3, 2]], [3, 4, 5]);
      testPagination('(3, 6)', [[6, 2]], [3, 4, 5, 6]);
      testPagination('(3, 6)', [[6, 2]], [3, 4, 5, 6]);
      testPagination(
        '(3, 2) (1 2)',
        [
          [3, 2],
          [1, 2],
        ],
        [5]
      );
      testPagination(
        '(3, 1) (6 2)',
        [
          [5, 1],
          [6, 2],
        ],
        [4, 5, 6]
      );
      testPagination(
        '(3, 1) (6 2)',
        [
          [5, 1],
          [2, 2],
        ],
        [4, 5]
      );
    });
  });
}
