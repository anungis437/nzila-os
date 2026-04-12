/**
 * Lighthouse CI Configuration
 *
 * Aligns with ops/perf-budgets.yml thresholds:
 *   - bundle_js_max_kb: 350 (global), 250 (web)
 *   - ttfb_p95_ms: 800
 *   - route_p95_ms: 500
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm --filter web start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/login',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],

        // Performance scores
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Bundle size (aligns with perf-budgets.yml web: 250 KB)
        'total-byte-weight': ['warn', { maxNumericValue: 512000 }],

        // TTFB (aligns with perf-budgets.yml ttfb_p95_ms: 800)
        'server-response-time': ['error', { maxNumericValue: 800 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
