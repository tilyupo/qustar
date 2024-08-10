import {SuiteContext} from '../describe.js';

export function describeJoin({describe, expectQuery, test}: SuiteContext) {
  describe('query', () => {
    describe('join', () => {
      test('without condition', async ({posts, users}) => {
        const query = users
          .join({
            type: 'inner',
            right: users,
            select: () => 1,
          })
          .limit(3);

        await expectQuery(query, [1, 1, 1]);
      });

      test('inner', async ({posts, users}) => {
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

      test('left', async ({comments}) => {
        const query = comments
          .join({
            type: 'left',
            right: comments,
            select: (child, parent) => parent.id,
            condition: (child, parent) => child.parent_id.eq(parent.id),
          })
          .filter(x => x.ne(1))
          .orderByAsc(x => x, {nulls: 'first'});

        await expectQuery(query, [null, null, 5, 5]);
      });

      test('right', async ({comments}) => {
        const query = comments
          .join({
            type: 'right',
            right: comments,
            select: child => child.id,
            condition: (child, parent) => child.parent_id.eq(parent.id),
          })
          .filter(x => x.ne(1))
          .orderByAsc(x => x, {nulls: 'last'});

        await expectQuery(query, [6, 8, null, null, null]);
      });

      test('full', async ({comments}) => {
        const query = comments
          .join({
            type: 'full',
            right: comments,
            select: (child, parent) => ({
              c: child.id,
              p: parent.id,
            }),
            condition: (child, parent) => child.parent_id.eq(parent.id),
          })
          .filter(x => x.c.ne(1))
          .orderByAsc(x => x.c, {nulls: 'last'})
          .thenByAsc(x => x.p, {nulls: 'last'});

        await expectQuery(query, [
          {c: 5, p: null},
          {c: 6, p: 5},
          {c: 7, p: null},
          {c: 8, p: 5},
          {c: null, p: 6},
          {c: null, p: 7},
          {c: null, p: 8},
        ]);
      });
    });
  });
}
