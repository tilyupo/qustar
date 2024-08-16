import {Query, QueryTerminatorExpr, SingleLiteralValue} from 'qustar';
import {SuiteContext} from '../describe.js';
import {Post, QuerySet} from '../utils.js';

export function describeTerminator({describe, testFactory}: SuiteContext) {
  describe('query', () => {
    describe('terminator', () => {
      const testTerm = testFactory(
        <T extends SingleLiteralValue>(
          {posts}: QuerySet,
          mapper: (q: Query<Post>) => QueryTerminatorExpr<T>
        ) => {
          return mapper(posts);
        }
      );

      describe('max', () => {
        testTerm('id', posts => posts.max(x => x.id), 6);
        testTerm('author.id', posts => posts.max(x => x.author.id), 3);
      });

      describe('min', () => {
        testTerm('id', posts => posts.min(x => x.id), 1);
        testTerm(
          'id (with order)',
          posts => posts.orderByAsc(x => x.id).min(x => x.id),
          1
        );
        testTerm('author.id', posts => posts.min(x => x.author.id), 1);
      });

      (['size', 'length', 'count'] as const).forEach(method =>
        describe(method, () => {
          testTerm('id', posts => posts[method](), 6);
          testTerm(
            'id (with order)',
            posts => posts.orderByAsc(x => x.id)[method](),
            6
          );
          testTerm('title', posts => posts.limit(2)[method](), 2);
          testTerm(
            'comments',
            posts => posts.flatMap(x => x.comments)[method](),
            4,
            {
              optOnly: true,
            }
          );
        })
      );

      (['mean', 'avg', 'average'] as const).forEach(method =>
        describe(method, () => {
          testTerm(
            'id',
            posts => posts[method](x => x.id),
            (1 + 2 + 3 + 4 + 5 + 6) / 6
          );
          testTerm(
            'id (with order)',
            posts => posts.orderByAsc(x => x.id)[method](x => x.id),
            (1 + 2 + 3 + 4 + 5 + 6) / 6
          );
          testTerm(
            'author.id',
            posts => posts[method](x => x.author.id.mul(3).div(2)),
            ((1 + 1 + 1 + 2 + 2 + 3) * 3) / 2 / 6
          );
        })
      );

      describe('sum', () => {
        testTerm('id', posts => posts.sum(x => x.id), 1 + 2 + 3 + 4 + 5 + 6);
        testTerm(
          'id (with order)',
          posts => posts.orderByAsc(x => x.id).sum(x => x.id),
          1 + 2 + 3 + 4 + 5 + 6
        );
        testTerm(
          'author.id',
          posts => posts.sum(x => x.author.id),
          1 + 1 + 1 + 2 + 2 + 3
        );
      });

      describe('some', () => {
        testTerm('true', posts => posts.some(), true);
        testTerm(
          'false',
          posts => posts.filter(x => x.id.eq(-1)).some(),
          false
        );
      });

      describe('empty', () => {
        testTerm('true', posts => posts.empty(), false);
        testTerm(
          'true (with order)',
          posts => posts.orderByDesc(x => x.id).empty(),
          false
        );
        testTerm(
          'false',
          posts => posts.filter(x => x.id.eq(-1)).empty(),
          true
        );
      });

      describe('first', () => {
        testTerm(
          'first comment order by id',
          posts =>
            posts
              .map(post =>
                post.comments.orderByDesc(x => x.id).first(x => x.id)
              )
              .sum(x => x),
          15
        );
        testTerm(
          'comment id sum',
          posts => posts.map(post => post.comments.sum(x => x.id)).sum(x => x),
          26
        );
      });
    });
  });
}
