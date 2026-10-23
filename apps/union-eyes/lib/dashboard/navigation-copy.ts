/** Existing next-intl catalog keys shared by desktop and mobile navigation. */
export function navigationCopyKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
