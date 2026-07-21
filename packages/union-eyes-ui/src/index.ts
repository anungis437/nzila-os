// @nzila/union-eyes-ui — neutral shared UI primitives for the Union Eyes
// operational and demo apps. Wave 0 §2 remediation.
//
// These files are shadcn-ui-style primitives with no application-specific
// logic. They MUST NOT contain:
//   - CUPE 4373 data
//   - synthetic fixture records
//   - environment branching
//   - provider credentials
//   - operational database adapters
//   - demo-specific services

export * from './components/badge';
export * from './components/button';
export * from './components/card';
export * from './components/input';
export * from './components/label';
export * from './components/progress';
export * from './components/separator';
export * from './components/sheet';
export * from './components/tabs';
export * from './components/textarea';
export { cn } from './lib/utils';
