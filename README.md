# Qustar

[![npm version](https://img.shields.io/npm/v/qustar.svg)](https://www.npmjs.com/package/qustar)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tilyupo/qustar/blob/main/LICENSE)

Query SQL database through an array-like API.

## Features

- High level query builder that doesn't limit you (seriously)
- Full TypeScript support
- Supports PostgreSQL, SQLite, MySQL and any other database through a custom connector
- Navigation properties
- No codegen, works with plain TypeScript/JavaScript
- All queries are translated into 100% SQL
- Raw SQL support

## Quick start

To start using qustar with PostgreSQL (the list of all supported data sources is [available below](#supported-database-drivers)) run the following command:

```sh
npm install qustar qustar-pg pg
```

Here an example usage of qustar:

```ts
import {PgConnector} from 'qustar-pg';
import {Query} from 'qustar';

// specify a schema
const users = await Query.table({
  name: 'users',
  schema: {
    id: 'i32', // 32 bit integer
    firstName: 'text', // any text
    lastName: 'text',
    age: {type: 'i32', nullable: true}, // nullable integer
  },
});

// compose a query
const query = users
  .orderByDesc(user => user.createdAt)
  // map will be translated to 100% SQL, as every other operation
  .map(user => ({
    name: user.firstName.concat(' ', user.lastName),
    age: user.age,
  }))
  .limit(3);

// connect to your database
const connector = new PgConnector('postgresql://qustar:passwd@localhost:5432');

// run the query
console.log('users:', await query.execute(connector));
```

## Supported database drivers

To execute query against a database you need a _connector_. There are many ready to use connectors that wrap existing NodeJS drivers:

- PostgreSQL
  - [qustar-pg](https://www.npmjs.com/package/qustar-pg)
- SQLite
  - [qustar-sqlite3](https://www.npmjs.com/package/qustar-sqlite3)
  - [qustar-better-sqlite3](https://www.npmjs.com/package/qustar-better-sqlite3)
- MySQL
  - [qustar-mysql2](https://www.npmjs.com/package/qustar-mysql2)
- MariaDB
  - [qustar-mysql2](https://www.npmjs.com/package/qustar-mysql2)

If you implemented your own connector, let me know and I will add it to the list above!

[//]: # 'todo: add a link to a guide for creating a custom connector'

## Usage

Any query starts from a table or a [raw sql](#raw-sql). We will talk more about raw queries later, for now the basic usage looks like this:

```ts
import {Query} from 'qustar';

const users = Query.table({
  name: 'users',
  schema: {
    id: 'i32',
    age: {type: 'i32', nullable: true},
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

// you can also use Expr to achieve the same
import {Expr} from 'qustar';

const b = users.map(user => Expr.eq(user.age.add(1), user.height.sub(5));
```

We can't use native operators like `+` or `===` because JavaScript doesn't support operator overloading. You can find full list of supported expression operations [here](#expressions).

Now lets talk about queries and expressions.

### Query

#### .filter(condition)

```ts
const adults = Query.table('users')
  // users with age >= 18
  .filter(user => /* any expression */ user.age.gte(18));
```

#### .map(mapper)

```ts
const userIds = Query.table('users').map(user => user.id);

const user = Query.table('users')
  // you can map to an object
  .map(user => ({id: user.id, name: user.name}));

const userInfo = Query.table('users')
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
const users = Query.table('users')
  // order by age in ascending order
  .orderByAsc(user => user.age)
  // then order by name in descending order
  .thenByDesc(user => user.name);
```

#### .drop(count), Query.limit(count)

```ts
const users = Query.table('users')
  .orderByAsc(user => user.id)
  // skip first ten users
  .drop(10)
  // then take only five
  .limit(5);
```

#### .slice(start, end)

You can also use `.slice` method to achieve the same:

```ts
const users = Query.table('users')
  // start = 10, end = 15
  .slice(10, 15);
```

#### .{inner,left,right}Join(options)

Qustar supports `.innerJoin`, `.leftJoin`, `.rightJoin` and `.fullJoin`:

```ts
const bobPosts = Query.table('posts')
  .innerJoin({
    right: Query.table('users'),
    // condition is optional
    condition: (post, user) => post.authorId.eq(user.id),
    select: (post, author) => ({
      text: post.text,
      author: author.name,
    }),
  })
  .filter(({author}) => author.like('bob%'));
```

Qustar also supports refs to avoid writing joins manually each time you need a related entity:

```ts
const posts = Query.table({
  name: 'posts',
  // we don't want to specify all table columns in this example, only the ref
  additionalProperties: true,
  schema: {
    author: {
      type: 'ref',
      // post can't exist without an author
      required: true,
      references: () => Query.table('users'),
      condition: (post, user) => post.authorId.eq(user.id),
    },
  },
});

// qustar will join users table automatically based on the condition above
const bobPosts = posts.filter(post => post.author.name.like('bob%'));
```

Here we used query [schema](#schema). We will talk more about schema later.

#### .unique()

You can select distinct rows using `.unique` method:

```ts
const names = Query.table('users')
  .map(user => user.name)
  .unique();
```

#### .groupBy(options)

```ts
const stats = Query.table('users').groupBy({
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
const studentNames = Query.table('students').map(student => student.name);
const teacherNames = Query.table('teachers').map(teacher => teacher.name);

const uniqueNames = studentNames.union(teacherNames);
```

#### .unionAll(query)

```ts
const studentNames = Query.table('students').map(student => student.name);
const teacherNames = Query.table('teachers').map(teacher => teacher.name);

const peopleCount = studentNames.unionAll(teacherNames).count();
```

#### .concat(query)

```ts
const studentNames = Query.table('students').map(student => student.name);
const teacherNames = Query.table('teachers').map(teacher => teacher.name);

// concat preserves original ordering
const allNames = studentNames.concat(teacherNames);
```

#### .intersect(query)

```ts
const studentNames = Query.table('students').map(student => student.name);
const teacherNames = Query.table('teachers').map(teacher => teacher.name);

const studentAndTeacherNames = studentNames.intersect(teacherNames);
```

#### .except(query)

```ts
const studentNames = Query.table('students').map(student => student.name);
const teacherNames = Query.table('teachers').map(teacher => teacher.name);

const studentOnlyNames = studentNames.except(teacherNames);
```

#### .flatMap(mapper)

```ts
const postsWithAuthor = Query.table('users').flatMap(user =>
  Query.table('posts')
    .filter(post => post.authorId.eq(user.id))
    .map(post => ({text: post.text, author: user.name}))
);
```

Qustar also supports `back_ref` properties:

```ts
const users = Query.table({
  name: 'users',
  // we don't want to specify all table columns in this example
  additionalProperties: true,
  schema: {
    posts: {
      type: 'back_ref',
      references: () => Query.table('posts'),
      condition: (user, post) => user.id.eq(post.authorId),
    },
  },
});

const postsWithAuthor = users.flatMap(user =>
  user.posts.map(post => ({text: post.text, author: user.name}))
);
```

#### Schema

Qustar requires you to define the schema statically:

```ts
const users = Query.table({
  name: 'users',
  schema: {
    // non nullable Int32 column
    id: {type: 'i32'},
    // nullable text column
    name: {type: 'text', nullable: true},
  },
});
```

Knowing schema ahead of time allows qustar to make some optimizations to improve resulting query. Defining query schema statically also enables you to put an entity into a nested field:

```ts
const posts = Query.table('posts')
  .innerJoin({
    // users table from the above example
    right: users,
    condition: (post, user) => post.authorId.eq(user.id),
    // notice that we put the whole user entity under the author property
    select: (post, user) => ({...post, author: user}),
  })
  // do something with the result
  .orderByAsc(({author}) => author.name);
```

Why do we need to know schema ahead of time to put an entity as a nested field? This is because of the SQL limitations. When we don't know all columns of the table, we have to use SQL wildcard `*` operator to select all columns. The operator can't add a prefix to selected columns. This means that some column names might overlap and we can't do anything about it. That is why we need to know all columns that need to be projected inside a nested object.

In the example above we can use `{...post}`, because it's used at the top level (SQL wildcard works at the top level as well). `{nested: {...post}}` wouldn't work.

The list of supported column types:

- **boolean**: true or false
- **null**: NULL
- **i8**: 8 bit integer
- **i16**: 16 bit integer
- **i32**: 32 bit integer
- **i64**: 64 bit integer
- **f32**: 32 bit floating point number
- **f64**: 64 bit floating point number
- **text**: variable length string

[//]: '#' 'todo: add ref/back_ref docs'

#### Raw sql

You can use raw SQL like so:

```ts
const users = Query.sql`SELECT * from users`
  // we must specify schema so qustar knows how to compose a query
  .schema({id: 'i32', age: 'i32'})
  .filter(user => user.age.lte(25))
  .map(user => user.id);
```

You can also use aliases in a nested query like so:

```ts
const postIds = Query.table('users').flatMap(user =>
  Query.sql`
    SELECT
      id
    FROM
      posts p
    WHERE p.authorId = ${user.id}'
  `.schema({id: 'i32'})
);
```

As you can see, you must call `Query.schema` to specify columns statically:

```ts
const users = query: Query.sql`SELECT id, name FROM users`.schema({
  id: {type: 'i32'},
  name: {type: 'text', nullable: true},
  // you can use 'ref' and 'back_ref' as well
});
```

## License

MIT License, see `LICENSE`.
