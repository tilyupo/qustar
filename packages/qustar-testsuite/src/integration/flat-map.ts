import {SuiteContext} from '../describe.js';

export function describeFlatMap({describe, test, expectQuery}: SuiteContext) {
  describe('query', () => {
    describe('flatMap', () => {
      test('user posts', async ({users}) => {
        const query = users
          .flatMap(x => x.posts.map(y => y.title))
          .orderByAsc(x => x);

        await expectQuery(
          query,
          ['C#', 'C++', 'Python', 'Ruby', 'TypeScript', 'rust'],
          {optOnly: true}
        );
      });

      test('user posts preserve ordering', async ({users}) => {
        const query = users
          .orderByAsc(x => x.id)
          .flatMap(x => x.posts.map(y => y.id).orderByDesc(x => x));

        await expectQuery(query, [3, 2, 1, 5, 4, 6], {
          optOnly: true,
        });
      });

      test('comments boolean deleted', async ({users}) => {
        const query = users
          .flatMap(x => x.comments.map(x => ({id: x.id, deleted: x.deleted})))
          .orderByAsc(x => x.id)
          .map(x => x.deleted);

        await expectQuery(query, [false, false, false, true], {
          optOnly: true,
        });
      });

      test(
        'nested refs',
        async ({posts}) => {
          const query = posts
            .flatMap(post =>
              post.comments.map(comment => ({
                author: comment.author.id,
              }))
            )
            .map(x => x.author);

          await expectQuery(query, [1, 1, 2, 3], {
            optOnly: true,
          });
        },
        {staticOnly: true}
      );
    });
  });
}
