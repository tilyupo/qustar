async function loadSqlite3(): Promise<typeof import('sqlite3')> {
  if (typeof require === 'function') {
    return require('sqlite3');
  } else {
    return (await import('sqlite3')).default;
  }
}

export {loadSqlite3};
