import {describe, expect, test} from 'vitest';

import {describeConnectorInternal} from '../src/describe.js';

describeConnectorInternal(
  {test, describe, expectDeepEqual: (a, b, m) => expect(a).to.deep.equal(b, m)},
  undefined,
  {
    fuzzing: false,
    rawSql: false,
    lateralSupport: false,
  }
);
