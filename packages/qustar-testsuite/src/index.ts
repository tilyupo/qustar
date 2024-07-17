import {DataSource} from 'qustar';
import {describeFuzzing} from './fuzzing.js';
import {describeCombination} from './integration/combination.js';
import {describeExpr} from './integration/expr.js';
import {describeFlatMap} from './integration/flat-map.js';
import {describeGroupBy} from './integration/group-by.js';
import {describeJoin} from './integration/join.js';
import {describeMap} from './integration/map.js';
import {describeOrder} from './integration/order.js';
import {describePagination} from './integration/pagination.js';
import {describeSql} from './integration/sql.js';
import {describeTerminator} from './integration/terminator.js';
import {describeUnique} from './integration/unique.js';
import {buildUtils, DescribeOrmUtils} from './utils.js';

export interface TestApi {
  test: (name: string, f: () => Promise<void> | void) => void;
  describe: (name: string, f: () => Promise<void> | void) => void;
}

export interface TestSuiteOptions {
  fuzzing: boolean;
}

export function describeDataSource(
  api: TestApi,
  provider: DataSource,
  {fuzzing}: TestSuiteOptions
) {
  init(provider);

  const ctx: SuiteContext = {
    ...buildUtils(provider, api),
    describe: api.describe,
  };

  describeCombination(ctx);
  describeExpr(ctx);
  describeFlatMap(ctx);
  describeGroupBy(ctx);
  describeJoin(ctx);
  describeMap(ctx);
  describeOrder(ctx);
  describePagination(ctx);
  describeSql(ctx);
  describeTerminator(ctx);
  describeUnique(ctx);

  if (fuzzing) {
    describeFuzzing(ctx);
  }
}

export interface SuiteContext extends DescribeOrmUtils {
  describe: (name: string, f: () => Promise<void> | void) => void;
}

export async function init(provider: DataSource) {
  const sql = /*sql*/ `
    CREATE TABLE users (
      id INT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE posts (
      id INT NOT NULL,
      title TEXT NOT NULL,
      author_id INT NOT NULL
    );

    CREATE TABLE comments (
      id INT NOT NULL,
      text TEXT NOT NULL,
      post_id INT NOT NULL,
      commenter_id INT NOT NULL,
      deleted BIT NOT NULL,
      parent_id INT NULL
    );

    --

    INSERT INTO
      users
    VALUES
      (1, 'Dima'),
      (2, 'Anna'),
      (3, 'Max');

    INSERT INTO
      posts
    VALUES
      (1, 'TypeScript', 1),
      (2, 'rust', 1),
      (3, 'C#', 1),
      (4, 'Ruby', 2),
      (5, 'C++', 2),
      (6, 'Python', 3);

    INSERT INTO
      comments(id, text, post_id, commenter_id, deleted, parent_id)
    VALUES
      (5, 'cool', 1, 1, 0, NULL),
      (6, '+1', 1, 1, 0, 5),
      (7, 'me too', 1, 2, 0, NULL),
      (8, 'nah', 2, 3, 1, 5);
  `;

  provider.execute({args: [], src: sql});
}
