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
