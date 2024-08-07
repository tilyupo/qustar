import {Database} from 'sqlite3';
import {Sqlite3Connector} from '../src/data-sources/sqlite3';

(async () => {
  // connect to your favorite database
  const db = new Database(':memory:');

  // create a Connector
  const connector = new Sqlite3Connector(db);

  // run a query
  const users = await Query.table('users')
    .orderByDesc(user => user.createdAt)
    .map(user => ({
      name: user.firstName.concat(' ', user.lastName),
      age: user.age,
    }))
    .limit(3)
    .execute(connector);

  // use the result
  console.log(users);
})();
