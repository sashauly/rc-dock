import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.test.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/dom/**/*.test.tsx'],
          setupFiles: ['test/setup/dom.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.tsx'],
          setupFiles: ['test/setup/browser.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{browser: 'chromium'}],
            viewport: {width: 1024, height: 768},
            screenshotDirectory: '.vitest/screenshots',
          },
        },
      },
    ],
  },
});
