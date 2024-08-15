async function loadPg(): Promise<typeof import('pg')> {
  if (typeof require === 'function') {
    return require('pg');
  } else {
    return (await import('pg')).default;
  }
}

export {loadPg};
