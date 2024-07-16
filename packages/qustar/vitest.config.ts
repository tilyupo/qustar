import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'build/**/*'],
    coverage: {
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'run.ts',
        'src/types.ts',
      ],
    },
  },
});
