import {describe, test} from 'vitest';

import {describeConnectorInternal} from '../src/describe.js';

describeConnectorInternal({test, describe}, undefined, {
  fuzzing: false,
  rawSql: false,
  lateralSupport: false,
});
