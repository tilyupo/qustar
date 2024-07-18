import {describe, test} from 'vitest';

import {describeDataSourceInternal} from '../src/describe';

describeDataSourceInternal({test, describe}, undefined, {fuzzing: false});
