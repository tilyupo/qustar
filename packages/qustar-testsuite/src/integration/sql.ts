import {collection} from 'qustar';
import {SuiteContext} from '../index.js';

export function describeSql({describe, expectQuery, test}: SuiteContext) {
  describe('query', () => {
    describe('sql', () => {
      test('SELECT 1 as value', async () => {
        const query = collection({sql: 'SELECT 1 as value'});

        await expectQuery(query, [{value: 1}]);
      });

      test('row_number', async () => {
        const query = collection({
          sql: `
          SELECT
            p.id,
            ROW_NUMBER () OVER (PARTITION BY p.author_id ORDER BY p.id) AS idx
          FROM
            posts AS p
        `,
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
    });
  });
}
