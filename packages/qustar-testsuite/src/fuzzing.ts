import {compileQuery, gen, interpretQuery, renderSqlite} from 'qustar';
import {expect} from 'vitest';
import {EXAMPLE_DB, comments, posts} from './db.js';
import {SuiteContext} from './describe.js';

export function describeFuzzing({describe, execute, test}: SuiteContext) {
  describe('fuzzing', async () => {
    test('query', async () => {
      for (let i = 1; i < 1024; i += 1) {
        const seed = i.toString();
        const query = gen([comments, posts], {
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
        } catch (err: any) {
          if (
            err.code === 'SQLITE_ERROR' &&
            err.message.startsWith('SQLITE_ERROR: parser stack overflow')
          ) {
            continue;
          }
          (err.message +=
            '\n\n' +
            renderSqlite(compileQuery(query, {parameters: false})).src),
            (err.message += `\n\n seed: ${seed}`);
          throw err;
        }
      }
    });
  });
}
