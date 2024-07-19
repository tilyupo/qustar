# Qustar

Qustar allows you to query SQL database in a way that you would interact with a local array.

## Motivation

Existing solutions are falling into two camps:

1. **High level ORM**. ([Prisma](https://github.com/prisma/prisma), [TypeORM](https://github.com/typeorm/typeorm).
   Those provide rigid high level api that works well in simple cases but fails when something non trivial is needed. It also forces you to learn a banch of specific API that is different for every library.
2. **Low level SQL query buidlers**. ([knex](https://github.com/knex/knex), [Drizzle](https://github.com/drizzle-team/drizzle-orm)). Those don't force you to use library specific API to write queries and have SQL feal. The problem with those that they are usually too verbose.

**Qustar** aims to provide familiar API and flexibility without sacraficing ease of use. Qustar achives it throw mimicing native JavaScript array API (`filter`, `map`, `slice`, `flatMap` etc).

## Quick star

To star using qustar with SQLite (the list of all supported data sources is available below) run the following command:

```sh
npm install qustar qustar-better-sqlite3 better-sqlite3
```

Here an example usage of qustar:

```ts
// qustar can work with a varaety of SQL databases
import {Sqlite3DataSource} from 'qustar-better-sqlite3';
import {collection} from 'qustar';

// create a DataSource
const dataSource = new Sqlite3DataSource('/path/to/your/database');

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
```
