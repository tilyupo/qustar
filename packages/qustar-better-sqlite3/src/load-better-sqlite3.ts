async function loadBetterSqlite3(): Promise<typeof import('better-sqlite3')> {
  if (typeof require === 'function') {
    return require('better-sqlite3');
  } else {
    return (await import('better-sqlite3')).default;
  }
}

export {loadBetterSqlite3};
