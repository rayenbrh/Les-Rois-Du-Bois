import puppeteer from 'puppeteer';

/**
 * One shared headless Chromium for the whole process, plus a small concurrency
 * limit (the production server has 1 CPU / 3.8 GB RAM). PUPPETEER_EXECUTABLE_PATH
 * (set to /usr/bin/chromium in the Docker images) is honoured by puppeteer itself.
 */

const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.PDF_MAX_CONCURRENCY, 10) || 2);
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--font-render-hinting=none',
];

let browserPromise = null;
let active = 0;
const waiting = [];

const launch = () => {
  const promise = puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
  promise
    .then((browser) => {
      browser.on('disconnected', () => {
        if (browserPromise === promise) browserPromise = null;
      });
    })
    .catch(() => {
      if (browserPromise === promise) browserPromise = null;
    });
  return promise;
};

const getBrowser = async () => {
  if (!browserPromise) browserPromise = launch();
  const browser = await browserPromise;
  if (browser.connected === false) {
    browserPromise = launch();
    return browserPromise;
  }
  return browser;
};

const acquireSlot = () => {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
};

const releaseSlot = () => {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
};

/**
 * Run `fn(page)` on a fresh page of the shared browser, inside the concurrency limit.
 * The page is always closed afterwards.
 */
export const withPage = async (fn) => {
  await acquireSlot();
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    return await fn(page);
  } finally {
    if (page) await page.close().catch(() => {});
    releaseSlot();
  }
};

/** Close the shared browser (tests, graceful shutdown). */
export const closeBrowser = async () => {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Browser already gone: nothing to close.
  }
};
