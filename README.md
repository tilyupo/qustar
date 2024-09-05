# Qustar

[![npm version](https://img.shields.io/npm/v/qustar.svg)](https://www.npmjs.com/package/qustar)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tilyupo/qustar/blob/main/LICENSE)

Query SQL database through an array-like API.

## Features

✅ Expressive AND high-level query builder  
✅ TypeScript support  
✅ SQL databases:  
  ✅ PostgreSQL  
  ✅ SQLite  
  ✅ MySQL  
  ✅ MariaDB  
  ⬜ SQL Server  
  ⬜ Oracle  
✅ Navigation properties  
✅ Codegen free  
✅ Surprise free, all queries produce 100% SQL  
✅ Raw SQL  
⬜ Migrations  
⬜ Transactions

## Quick start

To start using qustar with PostgreSQL (the list of all supported data sources is [available below](#supported-database-drivers)) run the following command:

```sh
npm install qustar qustar-pg pg
```

Here an example usage of qustar:

```ts
import {PgConnector} from 'qustar-pg';
import {Q} from 'qustar';

// specify a schema
const users = Q.table({
  name: 'users',
  schema: {
    // generated is not required during insert
    id: Q.i32().generated(), // 32 bit integer
    firstName: Q.string(), // any text
    lastName: Q.string(),
    age: Q.i32().null(), // nullable integer
  },
});

// compose a query
const query = users
  .orderByDesc(user => user.createdAt)
  // map will be translated into 100% SQL, as every other operation
  .map(user => ({
    name: user.firstName.concat(' ', user.lastName),
    age: user.age,
  }))
  .limit(3);

// connect to your database
const connector = new PgConnector('postgresql://qustar:passwd@localhost:5432');

// run the query
console.log('users:', await query.fetch(connector));
```

Output:

```js
{ age: 54, name: 'Linus Torvalds' }
{ age: 29, name: 'Clark Kent' }
{ age: 18, name: 'John Smith' }
```

The query above will be translated to:

```sql
SELECT
  "s1"."age",
  concat("s1"."firstName", ' ', "s1"."lastName") AS "name"
FROM
  users AS "s1"
ORDER BY
  ("s1"."createdAt") DESC
LIMIT
  3
```

Insert/update/delete:

```ts
// insert
await users.insert({firstName: 'New', lastName: 'User'}).execute(connector);

// update
await users
  .filter(user => user.id.eq(42))
  .update(user => ({age: user.age.add(1)}))
  .execute(connector);

// delete
await users.delete(user => user.id.eq(42)).execute(connector);
```

## Supported database drivers

To execute query against a database you need a _connector_. There are many ready to use connectors that wrap existing NodeJS drivers:

- PostgreSQL
  - [qustar-pg](https://www.npmjs.com/package/qustar-pg)
- SQLite
  - [qustar-better-sqlite3](https://www.npmjs.com/package/qustar-better-sqlite3) (recommended)
  - [qustar-sqlite3](https://www.npmjs.com/package/qustar-sqlite3)
- MySQL
  - [qustar-mysql2](https://www.npmjs.com/package/qustar-mysql2)
- MariaDB
  - [qustar-mysql2](https://www.npmjs.com/package/qustar-mysql2)

If you implemented your own connector, let me know and I will add it to the list above!

[//]: # 'todo: add a link to a guide for creating a custom connector'

## Usage

Any query starts from a table or a [raw sql](#raw-sql). We will talk more about raw queries later, for now the basic usage looks like this:

```ts
import {Q} from 'qustar';

const users = Q.table({
  name: 'users',
  schema: {
    id: Q.i32(),
    age: Q.i32().null(),
    // ...
  },
});
```

In qustar you compose a query by calling query methods like `.filter` or `.map`:

```ts
const young = users.filter(user => user.age.lt(18));
const youngIds = young.map(user => user.id);

// or

const ids = users.filter(user => user.age.lt(18)).map(user => user.id);
```

Queries are immutable, so you can reuse them safely.

For methods like `.filter` or `.map` you pass a callback which returns an _expression_. Expression represents a condition or operation you wish to do. Expressions are build using methods like `.add` or `.eq`:

```ts
// for arrays you would write: users.filter(x => x.age + 1 === x.height - 5)
const a = users.filter(user => user.age.add(1).eq(user.height.sub(5)));

// you can also use Q.eq to achieve the same
import {Q} from 'qustar';

const b = users.map(user => Q.eq(user.age.add(1), user.height.sub(5));
```

We can't use native operators like `+` or `===` because JavaScript doesn't support operator overloading. You can find full list of supported expression operations [here](#expressions).

Now lets talk about queries and expressions.

### Query

#### .filter(condition)

```ts
const adults = users
  // users with age >= 18
  .filter(user => /* any expression */ user.age.gte(18));
```

#### .map(mapper)

```ts
const userIds = users.map(user => user.id);

const user = users
  // you can map to an object
  .map(user => ({id: user.id, name: user.name}));

const userInfo = users
  // you can map to nested objects
  .map(user => ({
    id: user.id,
    info: {
      adult: user.age.gte(18),
      nameLength: user.name.length(),
    },
  }));
```

#### .orderByDesc(selector), .orderByDescAsc(selector)

```ts
const users = users
  // order by age in ascending order
  .orderByAsc(user => user.age)
  // then order by name in descending order
  .thenByDesc(user => user.name);
```

#### .drop(count), Query.limit(count)

```ts
const users = users
  .orderByAsc(user => user.id)
  // skip first ten users
  .drop(10)
  // then take only five
  .limit(5);
```

#### .slice(start, end)

You can also use `.slice` method to achieve the same:

```ts
const users = users
  // start = 10, end = 15
  .slice(10, 15);
```

#### .{inner,left,right}Join(options)

Qustar supports `.innerJoin`, `.leftJoin`, `.rightJoin` and `.fullJoin`:

```ts
const bobPosts = posts
  .innerJoin({
    right: users,
    condition: (post, user) => post.authorId.eq(user.id),
    select: (post, author) => ({
      text: post.text,
      author: author.name,
    }),
  })
  .filter(({author}) => author.like('bob%'));
```

#### .unique()

You can select distinct rows using `.unique` method:

```ts
const names = users.map(user => user.name).unique();
```

#### .groupBy(options)

```ts
const stats = users.groupBy({
  by: user => user.age,
  select: user => ({
    age: user.age,
    count: Expr.count(1),
    averageTax: user.salary.mul(user.taxRate).mean(),
  }),
});
```

#### .union(query)

```ts
const studentNames = students.map(student => student.name);
const teacherNames = teachers.map(teacher => teacher.name);

const uniqueNames = studentNames.union(teacherNames);
```

#### .unionAll(query)

```ts
const studentNames = students.map(student => student.name);
const teacherNames = teachers.map(teacher => teacher.name);

const peopleCount = studentNames.unionAll(teacherNames).count();
```

#### .concat(query)

```ts
const studentNames = students.map(student => student.name);
const teacherNames = teachers.map(teacher => teacher.name);

// concat preserves original ordering
const allNames = studentNames.concat(teacherNames);
```

#### .intersect(query)

```ts
const studentNames = students.map(student => student.name);
const teacherNames = teachers.map(teacher => teacher.name);

const studentAndTeacherNames = studentNames.intersect(teacherNames);
```

#### .except(query)

```ts
const studentNames = students.map(student => student.name);
const teacherNames = teachers.map(teacher => teacher.name);

const studentOnlyNames = studentNames.except(teacherNames);
```

#### .flatMap(mapper)

```ts
const postsWithAuthor = users.flatMap(user =>
  posts
    .filter(post => post.authorId.eq(user.id))
    .map(post => ({text: post.text, author: user.name}))
);
```

#### .includes(value)

```ts
const userExists = users.map(user => user.id).includes(42);
```

#### Schema

The list of supported column types:

- **boolean**: true or false
- **null**: NULL
- **i8**: 8 bit integer
- **i16**: 16 bit integer
- **i32**: 32 bit integer
- **i64**: 64 bit integer
- **f32**: 32 bit floating point number
- **f64**: 64 bit floating point number
- **string**: variable length string

[//]: '#' 'todo: add ref/back_ref docs'

#### Raw sql

You can use raw SQL like so:

```ts
import {Q, sql} from 'qustar';

const users = Q.rawQuery({
  sql: sql`SELECT * from users`,
  // we must specify schema so qustar knows how to compose a query
  schema: {
    id: Q.i32(),
    age: Q.i32().null(),
  },
})
  .filter(user => user.age.lte(25))
  .map(user => user.id);
```

You can also use aliases in a nested query like so:

```ts
const postIds = users.flatMap(user =>
  Q.rawQuery({
    sql: sql`
      SELECT
        id
      FROM
        posts p
      WHERE p.authorId = ${user.id}'
    })`,
    schema: {
      id: Q.i32(),
    },
  });
);
```

You can use `Q.rawExpr` for raw SQL in a part of an operation:

```ts
const halfIds = users.map(user => ({
  halfId: Q.rawExpr({sql: sql`CAST(${user.id} as REAL) / 2`, schema: Q.f32()}),
  name: user.name,
}));
```

The query above will be translated to:

```sql
SELECT
  "s1"."name",
  (CAST(("s1"."id") as REAL) / 2) AS "halfId"
FROM
  users AS "s1"
```

## License

MIT License, see `LICENSE`.
