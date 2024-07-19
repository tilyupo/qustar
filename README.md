# Qustar

[![npm version](https://img.shields.io/npm/v/qustar.svg)](https://www.npmjs.com/package/qustar)
[![contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tilyupo/qustar/blob/main/CONTRIBUTING.md)
[![Coverage Status](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tilyupo/qustar/blob/main/LICENSE)

Query SQL database though an array-like API.

## Motivation

Existing solutions are falling into two camps:

1. **High level ORM**. ([Prisma](https://www.npmjs.com/package/prisma), [TypeORM](https://www.npmjs.com/package/typeorm).
   Those provide rigid high level api that works well in simple cases but fails when something non trivial is needed. It also forces you to learn a bunch of specific API that is different for every library.
2. **Low level SQL query builders**. ([knex](https://www.npmjs.com/package/knex), [Drizzle](https://www.npmjs.com/package/drizzle-orm)). Those don't force you to use library specific API to write queries and have SQL feal. The problem with those that they are usually too verbose.

**Qustar** aims to provide familiar API and flexibility without sacrificing ease of use. Qustar archives it throw mimicking native JavaScript array API (`filter`, `map`, `slice`, `flatMap` etc).

## Quick start

To star using qustar with SQLite (the list of all supported data sources is available below) run the following command:

```sh
npm install qustar qustar-sqlite3 sqlite3
```

Here an example usage of qustar:

```ts
// qustar can work with a variety of SQL databases
import {Sqlite3DataSource} from 'qustar-sqlite3';
import {collection} from 'qustar';

// create a Connector
const connector = new Sqlite3DataSource('/path/to/your/database');

// run a query
const users = await collection('users')
  .orderByDesc(user => user.createdAt)
  .map(user => ({
    name: user.firstName.concat(' ', user.lastName),
    age: user.age,
  }))
  .limit(3)
  .execute(connector);

// use the result
console.log(users);
```

## Supported database drivers

Qustar can work SQL databases:

- [PostgreSQL](https://en.wikipedia.org/wiki/PostgreSQL) (work in progress)
- [SQLite](https://en.wikipedia.org/wiki/SQLite)
- [MySQL](https://en.wikipedia.org/wiki/MySQL) (work in progress)
- [SQL Server](https://en.wikipedia.org/wiki/Microsoft_SQL_Server) (work in progress)
- [Oracle](https://en.wikipedia.org/wiki/Oracle_Database) (work in progress)
- [ClickHouse](https://en.wikipedia.org/wiki/ClickHouse) (work in progress)
- [MariaDB](https://en.wikipedia.org/wiki/MariaDB) (work in progress)

To execute query against a database you need a _connector_. There are many ready to use connectors that wrap existing NodeJS drivers:

- [qustar-sqlite3](https://www.npmjs.com/package/qustar-sqlite3) (wrapper for [sqlite3](https://www.npmjs.com/package/sqlite3))
- [qustar-better-sqlite3](https://www.npmjs.com/package/qustar-better-sqlite3) (wrapper for [better-sqlite3](https://www.npmjs.com/package/better-sqlite3))

[//]: # 'todo: add a link to a guide for creating a custom connector'

## Usage

Any query starts from a [named collection](#named-collection) or a [raw query](#raw-query). We will talk more about raw queries and named collections later, for now the basic usage looks like this:

```ts
import {collection} from 'qustar';

const users = collection('users');
const posts = collection('posts');
```

In qustar you compose a query by calling query methods like `.filter` or `.map`:

```ts
import {collection} from 'qustar';

const users = collection('users');
const young = users.filter(x => x.age.lt(18));
const ids = young.map(x => x.id);

// or

const ids = collection('users')
  .filter(x => x.age.lt(18))
  .map(x => x.id);
```

Queries are immutable, so you can reuse them safely.

In methods like `.filter` or `.map` you pass a callback that returns an _expression_. Expression represents a condition or operation you wish to do. Expressions are build using methods like `.add` or `.eq`:

```ts
const users = collection('users');
// for arrays you would write: users.filter(x => x.age + 1 === x.height - 5)
const a = users.filter(x => x.age.add(1).eq(x.height.sub(5)));

// you can also use Expr static methods directly
import {Expr} from 'qustar';

const b = users.map(x => Expr.eq(x.age.add(1), x.height.sub(5));
```

We can't use native operators like `+` or `===` because JavaScript doesn't support operator overloading. You can find full list of supported operations [here](#expressions).

Now lets talk more about queries and expression.

## Docs

### Table of contents

- [collection](#collection)

- [raw query](#raw-query)

- [queries](#queries):

  - [pipe](#pipe)
  - [render](#render)
  - [execute](#execute)
  - [exec](#exec)
  - [run](#run)
  - [groupBy](#groupBy)
  - [filter](#filter)
  - [where](#where)
  - [map](#map)
  - [select](#select)
  - [orderByAsc](#orderByAsc)
  - [orderByDesc](#orderByDesc)
  - [thenByAsc](#thenByAsc)
  - [thenByDesc](#thenByDesc)
  - [sortByDesc](#sortByDesc)
  - [sortByAsc](#sortByAsc)
  - [join](#join)
  - [leftJoin](#leftJoin)
  - [innerJoin](#innerJoin)
  - [rightJoin](#rightJoin)
  - [fullJoin](#fullJoin)
  - [flatMap](#flatMap)
  - [selectMany](#selectMany)
  - [combine](#combine)
  - [union](#union)
  - [unionAll](#unionAll)
  - [intersect](#intersect)
  - [except](#except)
  - [concat](#concat)
  - [unique](#unique)
  - [distinct](#distinct)
  - [uniq](#uniq)
  - [limit](#limit)
  - [slice](#slice)
  - [take](#take)
  - [offset](#offset)
  - [skip](#skip)
  - [drop](#drop)
  - [max](#max)
  - [min](#min)
  - [mean](#mean)
  - [avg](#avg)
  - [average](#average)
  - [sum](#sum)
  - [first](#first)
  - [contains](#contains)
  - [some](#some)
  - [any](#any)
  - [empty](#empty)
  - [size](#size)
  - [count](#count)
  - [length](#length)
  - [len](#len)

- [expressions](#expressions):

  - [from](#from)
  - [sql](#sql)
  - [bitwiseNot](#bitwisenot)
  - [not](#not)
  - [minus](#minus)
  - [minus](#minus)
  - [plus](#plus)
  - [plus](#plus)
  - [add](#add)
  - [sub](#sub)
  - [subtract](#subtract)
  - [mul](#mul)
  - [multiply](#multiply)
  - [div](#div)
  - [divide](#divide)
  - [mod](#mod)
  - [modulus](#modulus)
  - [shl](#shl)
  - [shiftLeft](#shiftleft)
  - [shr](#shr)
  - [shiftRight](#shiftright)
  - [bitwiseAnd](#bitwiseand)
  - [bitwiseXor](#bitwisexor)
  - [bitwiseOr](#bitwiseor)
  - [or](#or)
  - [and](#and)
  - [gt](#gt)
  - [greaterThan](#greaterthan)
  - [ge](#ge)
  - [gte](#gte)
  - [greaterThanOrEqualTo](#greaterthanorequalto)
  - [lt](#lt)
  - [lessThan](#lessthan)
  - [le](#le)
  - [lte](#lte)
  - [lessThanOrEqualTo](#lessthanorequalto)
  - [eq](#eq)
  - [equals](#equals)
  - [ne](#ne)
  - [notEquals](#notequals)
  - [like](#like)
  - [in](#in)
  - [ternary](#ternary)
  - [case](#case)
  - [case](#case)
  - [case](#case)
  - [substring](#substring)
  - [toString](#tostring)
  - [toFloat](#tofloat)
  - [toInt](#toint)
  - [concat](#concat)
  - [count](#count)
  - [avg](#avg)
  - [average](#average)
  - [sum](#sum)
  - [min](#min)
  - [max](#max)

### Queries

#### pipe

#### render

#### execute

#### exec

#### run

#### groupBy

#### filter

#### where

#### map

#### select

#### orderByAsc

#### orderByDesc

#### thenByAsc

#### thenByDesc

#### sortByDesc

#### sortByAsc

#### join

#### leftJoin

#### innerJoin

#### rightJoin

#### fullJoin

#### flatMap

#### selectMany

#### combine

#### union

#### unionAll

#### intersect

#### except

#### concat

#### unique

#### distinct

#### uniq

#### limit

#### slice

#### take

#### offset

#### skip

#### drop

#### max

#### min

#### mean

#### avg

#### average

#### sum

#### first

#### contains

#### some

#### any

#### empty

#### size

#### count

#### length

#### len

### Expressions

#### from

#### sql

#### bitwiseNot

#### not

#### minus

#### minus

#### plus

#### plus

#### add

#### sub

#### subtract

#### mul

#### multiply

#### div

#### divide

#### mod

#### modulus

#### shl

#### shiftLeft

#### shr

#### shiftRight

#### bitwiseAnd

#### bitwiseXor

#### bitwiseOr

#### or

#### and

#### gt

#### greaterThan

#### ge

#### gte

#### greaterThanOrEqualTo

#### lt

#### lessThan

#### le

#### lte

#### lessThanOrEqualTo

#### eq

#### equals

#### ne

#### notEquals

#### like

#### in

#### ternary

#### case

#### case

#### case

#### substring

#### toString

#### toFloat

#### toInt

#### concat

#### count

#### avg

#### average

#### sum

#### min

#### max
