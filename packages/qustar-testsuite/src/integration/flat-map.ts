import {posts, users} from '../db.js';
import {SuiteContext} from '../describe.js';

export function describeFlatMap({
  describe,
  test,
  expectQuery,
  lateralSupport,
}: SuiteContext) {
  describe('query', () => {
    describe('flatMap', () => {
      if (lateralSupport) {
        // there was a problem with ambiguous column selection because
        // system ordering __orm_system__ordering__0 was specified twice
        test('user post ids', async () => {
          const query = users
            .flatMap(x => x.posts.orderByAsc(x => x.id))
            .orderByAsc(x => x.id)
            .map(x => x.id);

          await expectQuery(query, [1, 2, 3, 4, 5, 6]);
        });
      }

      test('user posts (order by title)', async () => {
        const query = users
          .orderByDesc(x => x.id)
          .flatMap(x => x.posts.orderByAsc(x => x.id).map(y => y.title))
          .orderByAsc(x => x.toLowerCase());

        await expectQuery(
          query,
          ['C#', 'C++', 'Python', 'Ruby', 'rust', 'TypeScript'],
          {optOnly: !lateralSupport}
        );
      });

      test('user posts (preserve flat map order)', async () => {
        const query = users
          .orderByDesc(x => x.id)
          .flatMap(x => x.posts.orderByAsc(x => x.id).map(y => y.title));

        await expectQuery(
          query,
          ['Python', 'Ruby', 'C++', 'TypeScript', 'rust', 'C#'],
          {optOnly: !lateralSupport}
        );
      });

      test('user posts preserve ordering', async () => {
        const query = users
          .orderByAsc(x => x.id)
          .flatMap(x => x.posts.map(y => y.id).orderByDesc(x => x));

        await expectQuery(query, [3, 2, 1, 5, 4, 6], {
          optOnly: !lateralSupport,
        });
      });

      test('comments boolean deleted', async () => {
        const query = users
          .flatMap(x => x.comments.map(x => ({id: x.id, deleted: x.deleted})))
          .orderByAsc(x => x.id)
          .map(x => x.deleted);

        await expectQuery(query, [false, false, false, true], {
          optOnly: !lateralSupport,
        });
      });

      test('nested refs', async () => {
        const query = posts
          .orderByAsc(x => x.id)
          .flatMap(post =>
            post.comments
              .orderByAsc(x => x.id)
              .map(comment => ({
                author: comment.author.id,
              }))
          )
          .map(x => x.author);

        await expectQuery(query, [1, 1, 2, 3], {
          optOnly: !lateralSupport,
        });
      });
    });
  });
}
