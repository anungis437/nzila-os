/**
 * ESLint — Cognition Architecture Boundary Rule
 *
 * Enforces the convergence rules for institutional cognition:
 *
 *  1. All cognition primitives must be imported from
 *     `@nzila/institutional-cognition-core` (or its subpaths).
 *  2. Application code outside the cognition kernel must not define its
 *     own `*ExplainabilityEnvelope` or duplicate the canonical contracts.
 *  3. Engines must not import deprecated parallel cognition modules.
 *
 * Usage in eslint.config.mjs:
 *
 *   import cognitionArchitecture from '@nzila/institutional-cognition-core/eslint-cognition-architecture.mjs'
 *   export default [...other, cognitionArchitecture]
 */

/** @type {import('eslint').Linter.FlatConfig} */
const cognitionArchitectureConfig = {
  name: 'nzila/cognition-architecture',
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Disallow re-declaring the canonical envelope outside the kernel.
        selector:
          "TSInterfaceDeclaration[id.name='InstitutionalExplainabilityEnvelope']",
        message:
          'InstitutionalExplainabilityEnvelope is defined in @nzila/institutional-cognition-core. Import it; do not redeclare.',
      },
      {
        // Disallow re-declaring CognitionDomain outside the kernel.
        selector:
          "TSTypeAliasDeclaration[id.name='CognitionDomain'], TSEnumDeclaration[id.name='CognitionDomain']",
        message:
          'CognitionDomain is defined in @nzila/institutional-cognition-core. Import it; do not redeclare.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/cognition-core/legacy/*',
              '**/legacy-cognition/*',
            ],
            message:
              'Legacy cognition modules are deprecated. Use @nzila/institutional-cognition-core.',
          },
        ],
      },
    ],
  },
};

export default cognitionArchitectureConfig;
