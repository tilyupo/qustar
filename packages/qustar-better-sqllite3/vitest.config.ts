import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    exclude: [...configDefaults.exclude, 'build/**/*'],
    coverage: {
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'scripts/**/*',
        'src/types.ts',
      ],
    },
  },
});
