import {comments, posts, users} from '../db.js';
import {SuiteContext} from '../describe.js';

export function describeJoin({describe, expectQuery, test}: SuiteContext) {
  describe('query', () => {
    describe('join', () => {
      test('inner', async () => {
        const query = posts
          .join({
            type: 'inner',
            right: users,
            select: (post, user) => ({title: post.title, name: user.name}),
            condition: (post, user) => post.author_id.eq(user.id),
          })
          .orderByAsc(x => x.title)
          .limit(3);

        await expectQuery(query, [
          {name: 'Dima', title: 'C#'},
          {name: 'Anna', title: 'C++'},
          {name: 'Max', title: 'Python'},
        ]);
      });

      test('left', async () => {
        const query = comments
          .join({
            type: 'left',
            right: comments,
            select: (child, parent) => parent.id,
            condition: (child, parent) => child.parent_id.eq(parent.id),
          })
          .filter(x => x.ne(1))
          .orderByAsc(x => x);

        await expectQuery(query, [null, null, 5, 5]);
      });

      test('right', async () => {
        const query = comments
          .join({
            type: 'right',
            right: comments,
            select: child => child.id,
            condition: (child, parent) => child.parent_id.eq(parent.id),
          })
          .filter(x => x.ne(1))
          .orderByAsc(x => x);

        await expectQuery(query, [null, null, null, 6, 8]);
      });
    });
  });
}
