/**
 * The production storage behind the intake lifecycle: the application's own blob container, addressed only by the
 * exact keys the server issued. The upload is scanned for malware before it is written (putBlob).
 */
import { putBlob, deleteBlob, downloadBuffer } from '@/lib/blob-client';
import type { IntakeStorage } from '@/lib/documents/intake-lifecycle';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const blobIntakeStorage: IntakeStorage = {
  async put(key, bytes, contentType) {
    const stored = await putBlob(key, bytes, { contentType });
    // The store must have used the key we issued; anything else is not the identity the intake row records.
    if (stored.pathname !== key) {
      await deleteBlob(stored.pathname).catch(() => undefined);
      throw new Error('The stored object does not carry the issued key');
    }
  },
  read: (key) => downloadBuffer(DOCUMENT_BLOB_CONTAINER, key),
  remove: (key) => deleteBlob(key),
};
