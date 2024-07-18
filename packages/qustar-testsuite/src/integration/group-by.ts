import {Expr, FilterFn, MapValueFn, Mapping} from 'qustar';
import {SuiteContext} from '../describe.js';

export function describeGroupBy({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('groupBy', () => {
      describe('aggregation', () => {
        const testGroupBy = testFactory(
          <Result extends Mapping>(
            {posts},
            mapper: MapValueFn<number, Result>
          ) => {
            return posts
              .groupBy({
                by: x => x.author_id,
                select: x => ({author_id: x.author_id, value: mapper(x.id)}),
              })
              .orderByAsc(x => x.author_id)
              .map(x => x.value);
          }
        );

        testGroupBy('count', () => Expr.count(1), [3, 2, 1]);
        testGroupBy('max', x => Expr.max(x), [3, 5, 6]);
        testGroupBy('min', x => Expr.min(x), [1, 4, 6]);
        testGroupBy('sum', x => Expr.sum(x), [6, 9, 6]);
        testGroupBy('avg', x => Expr.avg(x), [2, 4.5, 6]);
        testGroupBy('average', x => Expr.average(x), [2, 4.5, 6]);
      });

      describe('having', () => {
        const testHaving = testFactory(({posts}, having: FilterFn<number>) => {
          return posts
            .groupBy({
              by: x => x.author_id,
              select: x => x.author_id,
              having: x => having(x.id),
            })
            .orderByAsc(x => x)
            .map(x => x);
        });

        testHaving('count', () => Expr.count(1).gte(2), [1, 2]);
        testHaving('max', x => Expr.max(x).lt(5), [1]);
        testHaving('min', x => Expr.min(x).lt(5), [1, 2]);
        testHaving('sum', x => Expr.sum(x).gt(7), [2]);
        testHaving('avg', x => Expr.avg(x).eq(2), [1]);
        testHaving('average', x => Expr.average(x).ne(4.5), [1, 3]);
      });
    });
  });
}
