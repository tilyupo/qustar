import {writeFile} from 'fs/promises';
import {run} from './common/utils';

(async () => {
  await run('rimraf', 'dist');
  await run('tsc');
  await run('tsc', '--outDir', './dist/cjs', '--module', 'commonjs');
  await writeFile(
    './dist/esm/package.json',
    '{"type":"module","sideEffects":false}'
  );
  await writeFile(
    './dist/cjs/package.json',
    '{"type":"commonjs","sideEffects":false}'
  );
})();
