// sqlite3-wrapper.ts

async function loadSqlite3(): Promise<typeof import('sqlite3')> {
  if (typeof require !== 'undefined') {
    // For CommonJS (Node)
    return require('sqlite3');
  } else {
    // For ES Modules
    return (await import('sqlite3')).default;
  }
}

export {loadSqlite3};
