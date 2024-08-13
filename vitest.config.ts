import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    hideSkippedTests: true,
    exclude: [...configDefaults.exclude, './dist/**/*'],
    coverage: {
      exclude: [...(configDefaults.coverage.exclude ?? [])],
    },
  },
});
