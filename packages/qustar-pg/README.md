# qustar-pg

PostgreSQL support for [qustar](https://www.npmjs.com/package/qustar) via [pg](https://www.npmjs.com/package/pg) package.

## Installation

To start using `pg` with `qustar` you need to install the following packages:

```
npm install qustar qustar-pg pg
```

## Usage

Here is a minimal example:

```ts
import {Q} from 'qustar';
import {PgConnector} from 'qustar-pg';

// create a connector for PostgreSQL database
const connector = new PgConnector(
  'postgresql://user:password@localhost:5432/qustar'
);

// construct a query
const query = Q.table({
  name: 'users',
  schema: {
    id: Q.i32(),
  },
});

// run the query using the connector
const users = await query.fetch(connector);

// use the result
console.log(users);

// close the connector
await connector.close();
```

You can also create `PgConnector` by passing an instance of a `pg` pool:

```ts
import {Pool} from 'pg';
import {PgConnector} from 'qustar-pg';

const pool = new Pool({
  database: 'qustar',
  port: 5432,
  user: 'user',
  password: 'password',
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
  sql: 'SELECT id FROM users WHERE id = $1',
  args: [42],
});
```

## License

MIT License, see `LICENSE`.
