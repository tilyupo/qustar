import {Dialect, Q, Query} from 'qustar';
import {TableQuery} from 'qustar/dist/esm/src/query/query';
import {match} from 'ts-pattern';

export interface User {
  id: number;
  name: string;

  posts: Post[];
  comments: Comment[];
}

export const users: Query<User> = Q.table<Q.Schema<User>>({
  name: 'users',
  schema: {
    id: Q.i32(),
    name: Q.string(),
    posts: Q.backRef({
      references: () => posts,
      condition: (user, post) => user.id.eq(post.author_id),
    }),
    comments: Q.backRef({
      references: () => comments,
      condition: (user, comment) => user.id.eq(comment.commenter_id),
    }),
  },
});

export interface Post {
  id: number;
  title: string;
  author_id: number;

  author: User;
  comments: Comment[];
}

export const posts: Query<Post> = Q.table<Q.Schema<Post>>({
  name: 'posts',
  schema: {
    id: Q.i32(),
    title: Q.string(),
    author_id: Q.i32(),
    author: Q.ref({
      references: () => users,
      condition: (post, user) => user.id.eq(post.author_id),
    }),
    comments: Q.backRef({
      references: () => comments,
      condition: (post, comment) => post.id.eq(comment.post_id),
    }),
  },
});

export interface Comment {
  id: number;
  text: string;
  post_id: number;
  commenter_id: number;
  parent_id: number | null;
  deleted: boolean;

  post: Post;
  author: User;
  parent: Comment | null;
}

export const comments: Query<Comment> = Query.table<Q.Schema<Comment>>({
  name: 'comments',
  schema: {
    id: Q.i32(),
    text: Q.string(),
    post_id: Q.i32(),
    commenter_id: Q.i32(),
    parent_id: Q.i32().null(),
    deleted: Q.boolean(),
    post: Q.ref({
      references: () => posts,
      condition: (comment, post) => post.id.eq(comment.post_id),
    }),
    author: Q.ref({
      references: () => users,
      condition: (comment, user) => user.id.eq(comment.commenter_id),
    }),
    parent: Q.ref({
      references: () => comments,
      condition: (comment, parent) => parent.id.eq(comment.parent_id),
    }).null(),
  },
});

export interface Job {
  id: number;
  name: string;
  salary: number | null;
  deleted: boolean;
  post_id: number | null;
  author_id: number;

  post: Post | null;
  author: User;
}

export const jobs: TableQuery<Q.Schema<Job>> = Q.table<Q.Schema<Job>>({
  name: 'jobs',
  schema: {
    id: Q.i32(),
    name: Q.string().generated(),
    post_id: Q.i32().null(),
    author_id: Q.i32(),
    salary: Q.i32().null(),
    deleted: Q.boolean(),
    post: Q.ref({
      references: () => posts,
      condition: (comment, post) => post.id.eq(comment.post_id),
    }).null(),
    author: Q.ref({
      references: () => users,
      condition: (comment, user) => user.id.eq(comment.commenter_id),
    }),
  },
});

export function createInitSqlScript(dialect: Dialect) {
  const booleanType = match(dialect)
    .with('mysql', () => 'BOOLEAN')
    .with('postgresql', () => 'BOOLEAN')
    .with('sqlite', () => 'BIT')
    .exhaustive();

  const trueValue = match(dialect)
    .with('mysql', () => 'true')
    .with('postgresql', () => 'true')
    .with('sqlite', () => '1')
    .exhaustive();

  const falseValue = match(dialect)
    .with('mysql', () => 'false')
    .with('postgresql', () => 'false')
    .with('sqlite', () => '0')
    .exhaustive();

  return /*sql*/ `
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL,
      name TEXT NOT NULL
    );
    --
    DELETE FROM users;
    --
    INSERT INTO
      users
    VALUES
      (1, 'Dima'),
      (2, 'Anna'),
      (3, 'Max');
    --
    CREATE TABLE IF NOT EXISTS posts (
      id INT NOT NULL,
      title TEXT NOT NULL,
      author_id INT NOT NULL
    );
    --
    DELETE FROM posts;
    --
    INSERT INTO
      posts
    VALUES
      (1, 'TypeScript', 1),
      (2, 'rust', 1),
      (3, 'C#', 1),
      (4, 'Ruby', 2),
      (5, 'C++', 2),
      (6, 'Python', 3);
    --
    CREATE TABLE IF NOT EXISTS comments (
      id INT NOT NULL,
      text TEXT NOT NULL,
      post_id INT NOT NULL,
      commenter_id INT NOT NULL,
      deleted ${booleanType} NOT NULL,
      parent_id INT NULL
    );
    --
    DELETE FROM comments;
    --
    INSERT INTO
      comments(id, text, post_id, commenter_id, deleted, parent_id)
    VALUES
      (5, 'cool', 1, 1, ${falseValue}, NULL),
      (6, '+1', 1, 1, ${falseValue}, 5),
      (7, 'me too', 1, 2, ${falseValue}, NULL),
      (8, 'nah', 2, 3, ${trueValue}, 5);
    --
    CREATE TABLE IF NOT EXISTS jobs (
      id INT NOT NULL,
      name TEXT NOT NULL DEFAULT 'unknown',
      salary INT NULL,
      deleted ${booleanType} NOT NULL,
      post_id INT NULL,
      author_id INT NOT NULL
    );
  `.split('--');
}

export const EXAMPLE_DB = {
  users: [
    {id: 1, name: 'Dima'},
    {id: 2, name: 'Anna'},
    {id: 3, name: 'Max'},
  ],
  posts: [
    {id: 1, title: 'TypeScript', author_id: 1},
    {id: 2, title: 'rust', author_id: 1},
    {id: 3, title: 'C#', author_id: 1},
    {id: 4, title: 'Ruby', author_id: 2},
    {id: 5, title: 'C++', author_id: 2},
    {id: 6, title: 'Python', author_id: 3},
  ],
  comments: [
    {
      id: 5,
      text: 'cool',
      post_id: 1,
      commenter_id: 1,
      deleted: 0,
      parent_id: null,
    },
    {
      id: 6,
      text: '+1',
      post_id: 1,
      commenter_id: 1,
      deleted: 0,
      parent_id: 5,
    },
    {
      id: 7,
      text: 'me too',
      post_id: 1,
      commenter_id: 2,
      deleted: 0,
      parent_id: null,
    },
    {
      id: 8,
      text: 'nah',
      post_id: 2,
      commenter_id: 3,
      deleted: 1,
      parent_id: 5,
    },
  ],
};
