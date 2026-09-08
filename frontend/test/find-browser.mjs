import { accessSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where to find a Chromium to drive.
 *
 * `playwright-core` ships no browser of its own, which is the point: rather
 * than downloading one, these checks reuse whatever the machine already has.
 * Every Windows install has Edge, so in practice nothing needs installing.
 *
 * Shared by the responsive check and the demo-flow rehearsal.
 */
export function findBrowser() {
  if (process.env.RESPONSIVE_BROWSER) {
    return process.env.RESPONSIVE_BROWSER;
  }

  const candidates = [];

  // A browser Playwright downloaded previously, whatever its build number.
  const cache = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (cache) {
    try {
      for (const entry of readdirSync(cache)) {
        if (entry.startsWith('chromium_headless_shell-')) {
          candidates.push(
            join(cache, entry, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
          );
        }
        if (entry.startsWith('chromium-')) {
          candidates.push(join(cache, entry, 'chrome-win', 'chrome.exe'));
        }
      }
    } catch {
      // No cache directory; fall through to the installed browsers below.
    }
  }

  candidates.push(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  );

  for (const path of candidates) {
    try {
      accessSync(path);
      return path;
    } catch {
      // Try the next one.
    }
  }

  throw new Error(
    'ไม่พบเบราว์เซอร์สำหรับตรวจ — ติดตั้ง Microsoft Edge หรือ Google Chrome ' +
      'หรือระบุ path เองด้วย RESPONSIVE_BROWSER',
  );
}
