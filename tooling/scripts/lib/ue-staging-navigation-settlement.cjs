'use strict';

/**
 * Real-provider staging acceptance must observe the final browser location,
 * rather than interpreting the URL at DOMContentLoaded as a settled Next.js
 * React Server Components redirect. This does NOT relax the role or route
 * policy: a missing redirect times out and fails closed.
 */
const DEFAULT_TIMEOUT_MS = 20_000;

function normalizedPath(input) {
  const pathname = new URL(String(input), 'https://staging.invalid').pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

function currentPath(page) {
  return normalizedPath(page.url());
}

function validateTimeout(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new Error('Invalid bounded navigation-settlement timeout');
  }
}

async function settleRoleLanding(page, expectedPath, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  validateTimeout(timeoutMs);
  const expected = normalizedPath(expectedPath);
  const initialPath = currentPath(page);
  if (initialPath !== expected) {
    try {
      await page.waitForURL(url => normalizedPath(url) === expected, { timeout: timeoutMs });
    } catch {
      throw new Error(
        'Required role-landing redirect did not settle: expected=' + expected +
        ' initial=' + initialPath + ' observed=' + currentPath(page),
      );
    }
  }
  const finalPath = currentPath(page);
  if (finalPath !== expected) {
    throw new Error('Role landing changed after redirect: expected=' + expected + ' observed=' + finalPath);
  }
  return { initialPath, finalPath, redirectedAfterDOMContentLoaded: initialPath !== finalPath };
}

async function settleRestrictedDestination(page, restrictedPath, responseStatus, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  validateTimeout(timeoutMs);
  const restricted = normalizedPath(restrictedPath);
  const initialPath = currentPath(page);
  if (responseStatus === 403) {
    return { responseStatus, initialPath, finalPath: initialPath, denialMode: 'HTTP_403' };
  }
  if (!Number.isInteger(responseStatus) || responseStatus < 200 || responseStatus >= 500) {
    throw new Error('Restricted destination returned an unexpected HTTP status: ' + responseStatus);
  }
  if (initialPath === restricted) {
    try {
      await page.waitForURL(url => normalizedPath(url) !== restricted, { timeout: timeoutMs });
    } catch {
      throw new Error(
        'Restricted destination still accessible after redirect-settlement window: route=' +
        restricted + ' status=' + responseStatus + ' observed=' + currentPath(page),
      );
    }
  }
  const finalPath = currentPath(page);
  if (finalPath === restricted) {
    throw new Error('Restricted destination remained accessible: route=' + restricted + ' status=' + responseStatus);
  }
  return { responseStatus, initialPath, finalPath, denialMode: 'BROWSER_REDIRECT' };
}

module.exports = { normalizedPath, settleRoleLanding, settleRestrictedDestination };
