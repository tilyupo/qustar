# qustar-better-sqlite3

SQLite support for [qustar](https://www.npmjs.com/package/qustar) via [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) package.

## Installation

To start using `better-sqlite3` with `qustar` you need to install the following packages:

```
npm install qustar qustar-better-sqlite3 better-sqlite3
```

## Usage

Here is a minimal example:

```ts
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

// close the connector
await connector.close();
```

You can also create `BetterSqlite3Connector` by passing an instance of `better-sqlite3` database:

```ts
import Database from 'better-sqlite3';

const db = new Database('/path/to/db.sqlite', {
  readonly: true,
  fileMustExist: false,
});

const connector = new BetterSqlite3Connector(db);
```

But usually it's more convenient to pass database options directly to the connector:

```ts
import {BetterSqlite3Connector} from 'qustar-better-sqlite3';

// connector will pass the options to better-sqlite3
const connector = new BetterSqlite3Connector('/path/to/db.sqlite', {
  readonly: true,
  fileMustExist: false,
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
