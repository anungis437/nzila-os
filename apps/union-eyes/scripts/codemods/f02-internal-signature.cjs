const fs = require('fs')
const edit = (file, fn) => {
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const after = fn(before)
  if (after === before) throw new Error('no change: ' + file)
  fs.writeFileSync(file, after)
}
const cut = (t, startMarker, endMarker) => {
  const a = t.indexOf(startMarker)
  const b = t.indexOf(endMarker)
  if (a < 0 || b < 0 || b < a) throw new Error('markers: ' + startMarker.slice(0, 40))
  return t.slice(0, a) + t.slice(b)
}

edit('lib/signature/providers.ts', (t) => {
  // The internal provider created envelopes that were never stored or sent and answered every status as "sent".
  t = cut(t, '/**\n * Internal Signature Provider', '/**\n * Factory to get the appropriate provider')
  t = t.replace('import { createHash } from "crypto";\n', '')
  t = t.replace('    // Always available\n    this.providers.set("internal", new InternalSignatureProvider());\n', '')
  t = t.replace('name: "docusign" | "hellosign" | "internal"', 'name: "docusign" | "hellosign"')
  t = t.replace(
    /static getDefaultProvider\(\): SignatureProvider \{[\s\S]*?\n  \}\n\}/,
    `static getDefaultProvider(): SignatureProvider {
    // There is no built-in signing: an envelope no provider stores or sends would be reported as sent and never signed.
    const provider = this.providers.get("docusign") || this.providers.get("hellosign");
    if (!provider) {
      throw new Error("No signature provider is configured");
    }
    return provider;
  }
}`,
  )
  return t
})

edit('lib/signature/__tests__/providers.test.ts', (t) => {
  t = cut(t, '// ─── InternalSignatureProvider ───', '// ─── DocuSignProvider ───')
  t = t.replace('  InternalSignatureProvider,\n', '')
  t = t.replace(
    /  it\('always has internal provider', \(\) => \{[\s\S]*?\n  \}\);\n\n/,
    `  // DEF-0B11-SOC-INTERNAL-SIGNATURE-PROVIDER-IS-A-STUB-THAT-SENDS-NOTHING-AND-THE-REQUEST-IS-RECORDED-AS-SENT: the built-in provider stored and
  // sent nothing and reported every envelope as sent. There is none now.
  it('has no built-in provider that pretends to send', () => {
    expect(() => (SignatureProviderFactory as any).getProvider('internal')).toThrow('Provider internal not configured');
  });

`,
  )
  t = t.replace(
    /  it\('getDefaultProvider falls back to internal', \(\) => \{[\s\S]*?\n  \}\);\n/,
    `  it('getDefaultProvider refuses, rather than falling back to a stub, when no provider is configured', () => {
    SignatureProviderFactory.initialize({});
    expect(() => SignatureProviderFactory.getDefaultProvider()).toThrow('No signature provider is configured');
  });
`,
  )
  return t
})
console.log('ok')
