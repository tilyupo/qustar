# qustar-mysql2

MySQL support for [qustar](https://www.npmjs.com/package/qustar) via [mysql2](https://www.npmjs.com/package/mysql2) package.

## Installation

To start using `mysql2` with `qustar` you need to install the following packages:

```
npm install qustar qustar-mysql2 mysql2
```

## Usage

Here is a minimal example:

```ts
import {Query} from 'qustar';
import {Mysql2Connector} from 'qustar-mysql2';

// create a connector for MySQL database
const connector = new Mysql2Connector(
  'mysql://user:password@localhost:3306/qustar'
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

// close the connector
await connector.close();
```

You can also create `Mysql2Connector` by passing an instance of a `mysql2` pool:

```ts
import {createPool} from 'mysql2';
import {Mysql2Connector} from 'qustar-mysql2';

const pool = createPool({
  database: 'qustar',
  port: 3306,
  user: 'user',
  password: 'password',
  host: 'localhost',
});

const connector = new Mysql2Connector(pool);
```

But usually it's more convenient to pass pool options directly to the connector:

```ts
import {Mysql2Connector} from 'qustar-mysql2';

// connector will pass the options to Pool
const connector = new Mysql2Connector({
  database: 'db',
  port: 3306,
  user: 'user',
  password: 'password',
  host: 'localhost',
});
```

You can run raw SQL using a connector:

```ts
// execute a statement
await connector.execute('INSERT INTO users VALUES (42);');

// run a query
await connector.query('SELECT 42 as meaning');

// run a parametrized query
await connector.query({
  sql: 'SELECT id FROM users WHERE id = ?',
  args: [42],
});
```

## License

MIT License, see `LICENSE`.
