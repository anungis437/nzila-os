// Verification errors must never persist Playwright's request-header call log.
function safeFailureSummary(error) {
  const name = /^[A-Za-z][A-Za-z0-9]*$/.test(error?.name ?? '') ? error.name : 'Error';
  const firstLine = String(error?.message ?? 'Unknown verification error').split(/\r?\n|\\n/, 1)[0];
  const message = firstLine
    .replace(/https?:\/\/[^\s<>"']+/g, value => {
      try {
        const url = new URL(value);
        url.username = ''; url.password = ''; url.search = ''; url.hash = '';
        return url.toString();
      } catch { return '[URL omitted]'; }
    })
    .replace(/\b(cookie|set-cookie|authorization|password|client[_ -]?secret|(?:access|refresh|session)[_ -]?token)\s*[:=]\s*.*/ig, '$1=[redacted]')
    .replace(/[A-Za-z0-9_-]{80,}/g, '[opaque value omitted]')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .slice(0, 500);
  return { error: name, message, requestDetailsOmitted: true };
}

// A dropped reused connection can be retried only for reads. HTTP responses,
// timeouts and write failures remain failures; no write is replayed here.
async function fetchWithReadResetRetry(context, url, options, onRetry = () => {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const maxRetries = ['GET', 'HEAD'].includes(method) ? 2 : 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await context.fetch(url, options);
    } catch (error) {
      const reset = error?.code === 'ECONNRESET' || /^apiRequestContext\.fetch: (?:socket hang up|.*ECONNRESET)/.test(String(error?.message ?? '').split(/\r?\n/, 1)[0]);
      if (!reset || attempt >= maxRetries) throw error;
      onRetry({ retry: attempt + 1, maxRetries, ...safeFailureSummary(error) });
    }
  }
}

module.exports = { safeFailureSummary, fetchWithReadResetRetry };
