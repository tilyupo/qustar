# qustar-pg

[pg](https://www.npmjs.com/package/pg) support for [qustar](https://www.npmjs.com/package/qustar).

## Installation

To start using `pg` with `qustar` you need to install the following packages:

```
npm install qustar qustar-pg pg
```

## Usage

Here is a minimal example:

```ts
import {Query} from 'qustar';
import {PgConnector} from 'qustar-pg';

// create a connector for PostgreSQL database
const connector = new PgConnector('postgresql://qustar:test@localhost:5432/db');

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
```

You can also create `PgConnector` by passing an instance of `pg` pool:

```ts
import {Pool} from 'pg';
import {PgConnector} from 'qustar-pg';

const pool = new Pool({
  database: 'db',
  port: 5432,
  user: 'qustar',
  password: 'test',
  host: 'localhost',
});

const connector = new PgConnector(pool);
```

But usually it's more convenient to pass pool options directly to the connector:

```ts
import {PgConnector} from 'qustar-pg';

// connector will pass the options to pg
const connector = new PgConnector({
  database: 'qustar',
  port: 5432,
  user: 'qustar',
  password: 'test',
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
  sql: 'SELECT id FROM users WHERE id = $1',
  args: [42],
});
```

## License

MIT License, see `LICENSE`.
