import {SuiteContext} from '..';
import {MapValueFn, Mapping} from '../../../qustar/src/types';
import {Post} from '../utils';

export function describeMap({
  describe,
  expectQuery,
  testFactory,
  test,
}: SuiteContext) {
  describe('query', () => {
    describe('map to', () => {
      const testMap = testFactory(
        <Result extends Mapping>({posts}, mapper: MapValueFn<Post, Result>) => {
          return [
            posts
              .orderByAsc(x => x.id)
              .map(mapper)
              .limit(1, 1),
            posts
              .orderByAsc(x => x.id)
              .limit(1, 1)
              .map(mapper),
            posts
              .limit(1, 1)
              .orderByAsc(x => x.id)
              .map(mapper),
          ];
        }
      );

      test('use ref after map', async ({comments}) => {
        const query = comments
          .map(x => x.post)
          .map(x => x.author)
          .orderByAsc(x => x.id)
          .map(x => x.name)
          .limit(3);

        await expectQuery(query, ['Dima', 'Dima', 'Dima']);
      });

      testMap('boolean', () => true, true);
      testMap('number', () => 3, 3);
      testMap('string', () => 'str', 'str');
      testMap('string', () => 'str', 'str');
      testMap('null', () => null, null);
      testMap('id column', x => x.id, 2);
      // testMap('unselection', x => ({...x, title: undefined}), {
      //   id: 2,
      //   author_id: 1,
      // });
      testMap('title column', x => x.title, 'rust');
      testMap('expression', x => x.id.add(3), 5);
      testMap('author name', x => x.author.name, 'Dima');
      testMap('author comments count', x => x.author.comments.count(), 2);
      testMap(
        'object',
        x => ({
          new_id: x.id.mul(3),
          text: x.title.concat(' ').concat(x.author.name),
        }),
        {new_id: 6, text: 'rust Dima'}
      );
      testMap('author', x => x.author, {id: 1, name: 'Dima'});
      testMap('self', x => x, {id: 2, title: 'rust', author_id: 1});
      testMap('spread post with literal', x => ({...x, x: 100500}), {
        id: 2,
        title: 'rust',
        author_id: 1,
        x: 100500,
      });
      testMap(
        'spread post with author',
        x => ({...x, x: 123, ...x.author, y: x.author.name}),
        {
          id: 1,
          title: 'rust',
          author_id: 1,
          x: 123,
          name: 'Dima',
          y: 'Dima',
        }
      );

      testMap(
        'nested ref',
        x => ({one: {id: x.id, title: x.title}, two: x.author}),
        {one: {id: 2, title: 'rust'}, two: {id: 1, name: 'Dima'}},
        {staticOnly: true}
      );

      testMap(
        'nested nested ref',
        x => ({one: {id: x.id, lvl1: {lvl2: {lvl3: 1}}}}),
        {one: {id: 2, lvl1: {lvl2: {lvl3: 1}}}},
        {staticOnly: true}
      );

      test(
        'use nested ref',
        async ({comments}) => {
          const query = comments
            .map(x => ({post: x.post}))
            .map(x => x.post.author.name);

          await expectQuery(query, ['Dima', 'Dima', 'Dima', 'Dima']);
        },
        {staticOnly: true}
      );

      testMap('special symbols', () => ({'%&""*"-+': 1}), {'%&""*"-+': 1});

      test(
        'two refs with the same name',
        async ({comments}) => {
          const query = comments
            .map(x => ({...x.post, ...x}))
            .map(x => x.author.name);

          await expectQuery(query, ['Dima', 'Dima', 'Anna', 'Max']);
        },
        {staticOnly: true}
      );

      test(
        'two refs with the same name',
        async ({comments}) => {
          const query = comments
            .map(x => ({...x, ...x.post}))
            .map(x => x.author.name);

          await expectQuery(query, ['Dima', 'Dima', 'Dima', 'Dima']);
        },
        {staticOnly: true}
      );
    });
  });
}
