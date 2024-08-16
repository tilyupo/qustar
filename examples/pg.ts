import {Query} from 'qustar';
import {PgConnector} from 'qustar-pg';

// create a connector for PostgreSQL database
const connector = new PgConnector(
  'postgresql://user:password@localhost:5432/qustar'
);

// construct a query
const query = Query.table({
  name: 'users',
  schema: {
    id: 'i32',
  },
});

// run the query using the connector
const users = await query.fetch(connector);

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
