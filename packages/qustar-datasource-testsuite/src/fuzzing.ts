import {expect} from 'vitest';
import {EXAMPLE_DB} from '../../qustar/src/example-schema';
import {compileQuery} from '../../qustar/src/expr/compiler';
import {gen} from '../../qustar/src/expr/gen';
import {interpretQuery} from '../../qustar/src/expr/interpreter';
import {renderSqlite} from '../../qustar/src/render/sqlite';
import {describeOrm} from '../utils';

describeOrm(
  'fuzzing',
  async ({execute, test}) => {
    test('query', async () => {
      for (let i = 1; i < 1024; i += 1) {
        const seed = i.toString();
        const query = gen({
          seed,
          disableFlatMap: true,
          disableGroupBy: true,
          maxDepth: 5,
        });
        try {
          const actual = await execute(query);
          const expected = interpretQuery(query, {
            db: EXAMPLE_DB,
          });

          expect(actual).to.deep.equal(expected);
        } catch (err) {
          if (
            err.code === 'SQLITE_ERROR' &&
            err.message.startsWith('SQLITE_ERROR: parser stack overflow')
          ) {
            continue;
          }
          (err.message +=
            '\n\n' +
            renderSqlite(compileQuery(query, {withParameters: false})).src),
            (err.message += `\n\n seed: ${seed}`);
          throw err;
        }
      }
    });
  },
  {gen: true}
);
