# qustar-sqlite3

SQLite support for [qustar](https://www.npmjs.com/package/qustar) via [sqlite3](https://www.npmjs.com/package/sqlite3) package.

## Installation

To start using `sqlite3` with `qustar` you need to install the following packages:

```
npm install qustar qustar-sqlite3 sqlite3
```

## Usage

Here is a minimal example:

```ts
import {Query} from 'qustar';
import {Sqlite3Connector} from 'qustar-sqlite3';

// create a connector for in-memory SQLite database
const connector = new Sqlite3Connector(':memory:');

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

You can also create `Sqlite3Connector` by passing an instance of `sqlite3` database:

```ts
import {Database} from 'sqlite3';

// read more about more in official docs for SQLite:
// https://www.sqlite.org/c3ref/c_open_autoproxy.html
const db = new Database('/path/to/db.sqlite' /* mode */ 2);

const connector = new Sqlite3Connector(db);
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
