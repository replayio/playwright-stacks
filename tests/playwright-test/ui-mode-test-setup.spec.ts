/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, retries, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('should run global setup and teardown', async ({ runUITest }) => {
  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      export default () => console.log('\\n%%from-global-setup');
    `,
    'globalTeardown.ts': `
      export default () => console.log('\\n%%from-global-teardown');
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.close();
  await expect.poll(() => testProcess.outputLines()).toEqual([
    'from-global-setup',
    'from-global-teardown',
  ]);
});

test('should teardown on sigint', async ({ runUITest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      export default () => console.log('\\n%%from-global-setup');
    `,
    'globalTeardown.ts': `
      export default () => console.log('\\n%%from-global-teardown');
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  testProcess.process.kill('SIGINT');
  await expect.poll(() => testProcess.outputLines()).toEqual([
    'from-global-setup',
    'from-global-teardown',
  ]);
});

const testsWithSetup = {
  'playwright.config.ts': `
    import { defineConfig } from '@playwright/test';
    export default defineConfig({
      projects: [
        { name: 'setup', teardown: 'teardown', testMatch: 'setup.ts' },
        { name: 'test', testMatch: 'test.ts', dependencies: ['setup'] },
        { name: 'teardown', testMatch: 'teardown.ts' },
      ]
    });
  `,
  'setup.ts': `
    import { test, expect } from '@playwright/test';
    test('setup', async ({}) => {
      console.log('from-setup');
    });
  `,
  'test.ts': `
    import { test, expect } from '@playwright/test';
    test('test', async ({}) => {
      console.log('from-test');
    });
  `,
  'teardown.ts': `
    import { test, expect } from '@playwright/test';
    test('teardown', async ({}) => {
      console.log('from-teardown');
    });
  `,
};

test('should run setup and teardown projects (1)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByLabel('setup').setChecked(false);
  await page.getByLabel('teardown').setChecked(false);
  await page.getByLabel('test').setChecked(false);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ setup.ts
        ✅ setup
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ✅ test.ts
        ✅ test
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-setup`);
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).toContainText(`from-teardown`);
});

test('should run setup and teardown projects (2)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByLabel('setup').setChecked(false);
  await page.getByLabel('teardown').setChecked(true);
  await page.getByLabel('test').setChecked(true);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ✅ test.ts
        ✅ test
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).toContainText(`from-teardown`);
  await expect(page.getByTestId('output')).not.toContainText(`from-setup`);
});

test('should run setup and teardown projects (3)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByLabel('setup').setChecked(false);
  await page.getByLabel('teardown').setChecked(false);
  await page.getByLabel('test').setChecked(true);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ test.ts
        ✅ test
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).not.toContainText(`from-setup`);
  await expect(page.getByTestId('output')).not.toContainText(`from-teardown`);
});

test('should run part of the setup only', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByLabel('setup').setChecked(true);
  await page.getByLabel('teardown').setChecked(true);
  await page.getByLabel('test').setChecked(true);

  await page.getByText('setup.ts').hover();
  await page.getByRole('listitem').filter({ hasText: 'setup.ts' }).getByTitle('Run').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ setup.ts <=
        ✅ setup
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ◯ test.ts
        ◯ test
  `);
});
