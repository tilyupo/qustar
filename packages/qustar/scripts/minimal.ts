import {Database} from 'sqlite3';
import {Sqlite3DataSource} from '../src/data-sources/sqlite3';
import {collection} from '../src/dx';

(async () => {
  // connect to your favorite database
  const db = new Database(':memory:');

  // create a DataSource
  const dataSource = new Sqlite3DataSource(db);

  // run a query
  const users = await collection('users')
    .orderByDesc(user => user.createdAt)
    .map(user => ({
      name: user.firstName.concat(' ', user.lastName),
      age: user.age,
    }))
    .limit(3)
    .execute(dataSource);

  // use the result
  console.log(users);
})();
