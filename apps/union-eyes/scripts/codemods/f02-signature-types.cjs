const fs = require('fs')
let s = fs.readFileSync('lib/signature/signature-service.ts', 'utf8').replace(/\r\n/g, '\n')
s = s.replace('  provider?: "docusign" | "hellosign" | "internal";', '  provider?: "docusign" | "hellosign";')
s = s.split('document.provider as "docusign" | "hellosign" | "internal"').join('document.provider as "docusign" | "hellosign"')
fs.writeFileSync('lib/signature/signature-service.ts', s)

let p = fs.readFileSync('lib/signature/providers.ts', 'utf8').replace(/\r\n/g, '\n')
p = p.replace('      throw new Error("No signature provider is configured");', '      throw ApiError.notImplemented("No signature provider is configured, so a document cannot be sent for signature");')
if (!/from ["']@\/lib\/api\/errors["']/.test(p)) {
  const firstImport = p.indexOf('import ')
  p = p.slice(0, firstImport) + 'import { ApiError } from "@/lib/api/errors";\n' + p.slice(firstImport)
}
fs.writeFileSync('lib/signature/providers.ts', p)
