import {Query, collection} from 'qustar';

export interface User {
  id: number;
  name: string;

  posts: Post[];
  comments: Comment[];
}

export interface Post {
  id: number;
  title: string;
  author_id: number;
  author: User;

  comments: Comment[];
}

export interface Comment {
  id: number;
  text: string;
  post_id: number;
  commenter_id: number;
  deleted: boolean;
  parent_id: number | null;

  post: Post;
  author: User;
  parent: Comment;
}

export const users: Query<User> = collection({
  name: 'users',
  schema: {
    posts: {
      type: 'children',
      child: () => posts,
      condition: (user, post) => user.id.eq(post.author_id),
    },
    comments: {
      type: 'children',
      child: () => comments,
      condition: (user, comment) => user.id.eq(comment.commenter_id),
    },
  },
});

export const staticUsers: Query<User> = collection({
  name: 'users',
  dynamic: false,
  schema: {
    id: {type: 'i32', nullable: false},
    name: {type: 'varchar', nullable: false},
    posts: {
      type: 'children',
      child: () => staticPosts,
      condition: (user, post) => user.id.eq(post.author_id),
    },
    comments: {
      type: 'children',
      child: () => staticComments,
      condition: (user, comment) => user.id.eq(comment.commenter_id),
    },
  },
});

export const posts: Query<Post> = collection({
  name: 'posts',
  schema: {
    author: {
      type: 'parent',
      required: true,
      parent: () => users,
      condition: (user, post) => user.id.eq(post.author_id),
    },
    comments: {
      type: 'children',
      child: () => comments,
      condition: (post, comment) => post.id.eq(comment.post_id),
    },
  },
});

export const staticPosts: Query<Post> = collection({
  name: 'posts',
  dynamic: false,
  schema: {
    id: {type: 'i32', nullable: false},
    title: {type: 'varchar', nullable: false},
    author_id: {type: 'i32', nullable: false},
    author: {
      type: 'parent',
      required: true,
      parent: () => staticUsers,
      condition: (user, post) => user.id.eq(post.author_id),
    },
    comments: {
      type: 'children',
      child: () => staticComments,
      condition: (post, comment) => post.id.eq(comment.post_id),
    },
  },
});

export const comments: Query<Comment> = collection({
  name: 'comments',
  schema: {
    post: {
      type: 'parent',
      required: true,
      parent: () => posts,
      condition: (post, comment) => post.id.eq(comment.post_id),
    },
    author: {
      type: 'parent',
      required: true,
      parent: () => users,
      condition: (user, comment) => user.id.eq(comment.commenter_id),
    },
    parent: {
      type: 'parent',
      parent: () => comments,
      condition: (parent, comment) => parent.id.eq(comment.parent_id),
    },
    deleted: {
      type: 'boolean',
    },
  },
});

export const staticComments: Query<Comment> = collection({
  name: 'comments',
  dynamic: false,
  schema: {
    id: {type: 'i32', nullable: false},
    text: {type: 'varchar', nullable: false},
    post_id: {type: 'i32', nullable: false},
    commenter_id: {type: 'i32', nullable: false},
    parent_id: {type: 'i32', nullable: true},
    post: {
      type: 'parent',
      required: true,
      parent: () => staticPosts,
      condition: (post, comment) => post.id.eq(comment.post_id),
    },
    author: {
      type: 'parent',
      required: true,
      parent: () => staticUsers,
      condition: (user, comment) => user.id.eq(comment.commenter_id),
    },
    parent: {
      type: 'parent',
      parent: () => staticComments,
      condition: (parent, comment) => parent.id.eq(comment.parent_id),
    },
    deleted: {
      type: 'boolean',
    },
  },
});

export const EXAMPLE_SCHEMA_INIT_SQL = /*sql*/ `
  CREATE TABLE users (
    id INT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE posts (
    id INT NOT NULL,
    title TEXT NOT NULL,
    author_id INT NOT NULL
  );

  CREATE TABLE comments (
    id INT NOT NULL,
    text TEXT NOT NULL,
    post_id INT NOT NULL,
    commenter_id INT NOT NULL,
    deleted BIT NOT NULL,
    parent_id INT NULL
  );

  --

  INSERT INTO
    users
  VALUES
    (1, 'Dima'),
    (2, 'Anna'),
    (3, 'Max');

  INSERT INTO
    posts
  VALUES
    (1, 'TypeScript', 1),
    (2, 'rust', 1),
    (3, 'C#', 1),
    (4, 'Ruby', 2),
    (5, 'C++', 2),
    (6, 'Python', 3);

  INSERT INTO
    comments(id, text, post_id, commenter_id, deleted, parent_id)
  VALUES
    (5, 'cool', 1, 1, 0, NULL),
    (6, '+1', 1, 1, 0, 5),
    (7, 'me too', 1, 2, 0, NULL),
    (8, 'nah', 2, 3, 1, 5);
`;

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
