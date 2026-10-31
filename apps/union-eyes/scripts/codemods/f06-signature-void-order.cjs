const fs = require('fs')
const file = 'lib/signature/signature-service.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sub = (from, to) => {
  if (!t.includes(from)) throw new Error('missing: ' + from.slice(0, 70))
  t = t.replace(from, to)
}
// void: a provider failure is not a void
sub(
  `        await provider.voidEnvelope(document.providerEnvelopeId, reason);
      } catch (_error) {
      }
    }`,
  `        await provider.voidEnvelope(document.providerEnvelopeId, reason);
      } catch (_error) {
        // The envelope is still live at the provider and can still be signed there. Recording the document as voided here would say otherwise,
        // so nothing is changed and the sender is told the void did not happen.
        throw new SignatureAuthorityError("CONFLICT", "The signature provider could not void the envelope, so the document was not voided");
      }
    }`,
)
// signing: expiry and order
sub(
  `      if (!open) throw new SignatureAuthorityError("CONFLICT", "This document is no longer open for signing");
`,
  `      if (!open) throw new SignatureAuthorityError("CONFLICT", "This document is no longer open for signing");

      // The stored terms of the request bind the signature: an expired request is not signed, and with sequential signing a signer waits for
      // every signer before them.
      const [terms] = await tx
        .select({ expiresAt: signatureDocuments.expiresAt, sequentialSigning: signatureDocuments.sequentialSigning })
        .from(signatureDocuments)
        .where(eq(signatureDocuments.id, document.id));
      if (terms?.expiresAt && terms.expiresAt.getTime() < Date.now()) {
        throw new SignatureAuthorityError("CONFLICT", "This signature request has expired");
      }
      if (terms?.sequentialSigning && existingSigner.signingOrder != null) {
        const earlier = await tx
          .select({ id: documentSigners.id, status: documentSigners.status })
          .from(documentSigners)
          .where(and(eq(documentSigners.documentId, document.id), lt(documentSigners.signingOrder, existingSigner.signingOrder)));
        if (earlier.some((signer) => signer.status !== "signed")) {
          throw new SignatureAuthorityError("CONFLICT", "An earlier signer has not signed yet");
        }
      }
`,
)
fs.writeFileSync(file, t)
console.log(t.match(/import \{[^}]*\} from "drizzle-orm";/)?.[0])
