import {describeConnector} from 'qustar-testsuite';
import {describe, expect, test} from 'vitest';
import {PgConnector} from '../src/pg.js';

if (true as any) {
  describeConnector(
    {test, describe},
    new PgConnector('postgresql://qustar:test@localhost:22783'),
    {fuzzing: false}
  );
} else {
  test('check', async () => {
    console.log('start');
    const connector = new PgConnector(
      'postgresql://qustar:test@localhost:22783'
    );
    console.log('check query');

    const rows = await connector.select({
      src: 'select * from (select 1 as a, 2 as a) x',
      args: [],
    });

    console.log('get query');
    expect(rows).to.deep.equal([1]);
  });
}
