import fs from 'node:fs';
import * as playwright from 'playwright-core';
import { registry } from 'playwright-core/lib/server';
import type { BrowserType } from './input/schema.js';
import {
  beforeExitHandlers,
  logInfo,
  logSuccess,
  pathEquals,
  suspendLogging,
} from './util.js';

export async function launchBrowser({
  browserType,
  proxy,
  executablePath,
  headless,
  noSandbox,
  disableWebSecurity,
  disableDevShmUsage,
}: {
  browserType: BrowserType;
  proxy:
    | {
        server: string;
        bypass: string | undefined;
        username: string | undefined;
        password: string | undefined;
      }
    | undefined;
  executablePath: string;
  headless: boolean;
  noSandbox?: boolean;
  disableWebSecurity?: boolean;
  disableDevShmUsage?: boolean;
}): Promise<playwright.Browser> {
  const options =
    browserType === 'chromium'
      ? {
          executablePath,
          chromiumSandbox: !noSandbox,
          headless,
          args: [
            '--allow-file-access-from-files',
            disableWebSecurity ? '--disable-web-security' : '',
            disableDevShmUsage ? '--disable-dev-shm-usage' : '',
            // #357: Set devicePixelRatio=1 otherwise it causes layout issues in HiDPI displays
            headless ? '--force-device-scale-factor=1' : '',
            // set Chromium language to English to avoid locale-dependent issues (e.g. minimum font size)
            '--lang=en',
            ...(!headless && process.platform === 'darwin'
              ? ['-AppleLanguages', '(en)']
              : []),
          ],
          env: { ...process.env, LANG: 'en.UTF-8' },
          proxy: proxy,
        }
      : // TODO: Investigate appropriate settings on Firefox & Webkit
        { executablePath, headless };
  const browser = await playwright[browserType].launch(options);
  beforeExitHandlers.push(() => {
    browser.close();
  });
  return browser;
}

export function getExecutableBrowserPath(browserType: BrowserType): string {
  const executable = registry.findExecutable(getBrowserName(browserType))!;
  return executable.executablePath()!;
}

export function getFullBrowserName(browserType: BrowserType): string {
  return {
    chromium: 'Chromium',
    firefox: 'Firefox',
    webkit: 'Webkit',
  }[browserType];
}

export function checkBrowserAvailability(path: string): boolean {
  return fs.existsSync(path);
}

export function isPlaywrightExecutable(path: string): boolean {
  return registry
    .executables()
    .some((exe) => pathEquals(exe.executablePath() ?? '', path));
}

export async function downloadBrowser(
  browserType: BrowserType,
): Promise<string> {
  const executable = registry.findExecutable(getBrowserName(browserType))!;
  logInfo('Rendering browser is not installed yet. Downloading now...');
  const restartLogging = suspendLogging();
  await registry.install([executable], false);
  logSuccess(`Successfully downloaded browser`);
  restartLogging();
  return executable.executablePath()!;
}

function getBrowserName(
  browserType: BrowserType,
): BrowserType | 'chromium-headless-shell' {
  if (browserType === 'chromium' && !process.argv[1].endsWith('preview.js')) {
    return 'chromium-headless-shell';
  } else {
    return browserType;
  }
}
