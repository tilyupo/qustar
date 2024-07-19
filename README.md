# Qustar

[![npm version](https://img.shields.io/npm/v/qustar.svg)](https://www.npmjs.com/package/qustar)
[![contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tilyupo/qustar/blob/main/CONTRIBUTING.md)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tilyupo/qustar/blob/main/LICENSE)

Query SQL database through an array-like API.

## Motivation

Existing solutions are falling into two camps:

- **High level ORM**.  
   Those provide rigid high level API that works well in simple cases but fails when something non trivial is needed. It also forces you to learn a bunch of specific API that is different for every library.
- **Low level SQL query builders**.  
   Those are more flexible and generally look similar to SQL. The problem with those is that they are too verbose for typical tasks.

Qustar provides familiar API and flexibility without sacrificing ease of use. We archive it through mimicking native JavaScript array API (`filter`, `map`, `slice`, `flatMap`, etc).

## Quick start

To start using qustar with SQLite (the list of all supported data sources is available below) run the following command:

```sh
npm install qustar qustar-sqlite3 sqlite3
```

Here an example usage of qustar:

```ts
// qustar can work with a variety of SQL databases, we use SQLite as an example
import {Sqlite3Connector} from 'qustar-sqlite3';
import {collection} from 'qustar';

// create a Connector
const connector = new Sqlite3Connector('/path/to/your/database');

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

To execute query against a database you need a _connector_. There are many ready to use connectors that wrap existing NodeJS drivers:

- PostgreSQL
  - work in progress
- SQLite
  - [qustar-sqlite3](https://www.npmjs.com/package/qustar-sqlite3)
  - [qustar-better-sqlite3](https://www.npmjs.com/package/qustar-better-sqlite3)
- MySQL
  - work in progress
- SQL Server
  - work in progress
- Oracle
  - work in progress
- ClickHouse
  - work in progress
- MariaDB
  - work in progress

If you implemented your own connector, let me know and I will add it to the list above!

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
const young = users.filter(user => user.age.lt(18));
const ids = young.map(user => user.id);

// or

const ids = collection('users')
  .filter(user => user.age.lt(18))
  .map(user => user.id);
```

Queries are immutable, so you can reuse them safely.

In methods like `.filter` or `.map` you pass a callback that returns an _expression_. Expression represents a condition or operation you wish to do. Expressions are build using methods like `.add` or `.eq`:

```ts
const users = collection('users');
// for arrays you would write: users.filter(x => x.age + 1 === x.height - 5)
const a = users.filter(user => user.age.add(1).eq(user.height.sub(5)));

// you can also use Expr directly
import {Expr} from 'qustar';

const b = users.map(user => Expr.eq(user.age.add(1), user.height.sub(5));
```

We can't use native operators like `+` or `===` because JavaScript doesn't support operator overloading. You can find full list of supported operations [here](#expressions).

## Docs

### Table of contents

- [collection](#collection)

- [raw query](#raw-query)

- [queries](#queries)

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

- [expressions](#expressions)

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
