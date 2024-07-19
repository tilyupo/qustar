import {describe, test} from 'vitest';

import {describeConnectorInternal} from '../src/describe';

describeConnectorInternal({test, describe}, undefined, {
  fuzzing: false,
  rawSql: false,
});
