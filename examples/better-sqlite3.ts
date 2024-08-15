import {Query} from 'qustar';
import {BetterSqlite3Connector} from 'qustar-better-sqlite3';

// create a connector for in-memory SQLite database
const connector = new BetterSqlite3Connector(':memory:');

// construct a query
const query = Query.table({
  name: 'users',
  schema: {
    id: 'i32',
  },
});

// run the query using the connector
const users = await query.execute(connector);

// use the result
console.log(users);

// execute a statement
await connector.execute('INSERT INTO users VALUES (42);');

// run a query
await connector.query('SELECT 42 as meaning');

// run a parametrized query
await connector.query({
  sql: 'SELECT id FROM users WHERE id = ?',
  args: [42],
});

// close the connector
await connector.close();
