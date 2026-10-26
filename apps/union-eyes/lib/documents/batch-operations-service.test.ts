import { describe, expect, it } from 'vitest';
import {
  bulkCopy,
  bulkDelete,
  bulkTag,
  bulkUpdateMetadata,
  downloadMultiple,
  moveToFolder,
  validateDocumentPermissions,
} from './batch-operations-service';

const IDS = ['11111111-1111-4111-8111-111111111111'];

describe('batch document helpers', () => {
  it('refuses a direct storage archive', async () => {
    await expect(downloadMultiple(IDS, 'org', 'user')).rejects.toThrow(/Direct storage download is refused/);
  });

  it('refuses copy, tag, move, delete, and metadata writes', async () => {
    await expect(bulkCopy(IDS, null, 'org', 'user')).rejects.toThrow(/refused/);
    await expect(bulkTag(IDS, ['evidence'], 'org', 'user')).rejects.toThrow(/refused/);
    await expect(moveToFolder(IDS, null, 'org', 'user')).rejects.toThrow(/refused/);
    await expect(bulkDelete(IDS, 'org', 'user', 'admin')).rejects.toThrow(/refused/);
    await expect(bulkUpdateMetadata(IDS, { privacyLabel: 'public_internal' }, 'org', 'user')).rejects.toThrow(/privacy label/);
  });

  it('does not grant access from a role name', async () => {
    await expect(validateDocumentPermissions(IDS, 'org', 'user', 'admin')).resolves.toEqual({
      hasPermission: false,
      deniedDocuments: IDS,
    });
    await expect(validateDocumentPermissions(IDS, 'org', 'user', 'union_leader')).resolves.toEqual({
      hasPermission: false,
      deniedDocuments: IDS,
    });
  });
});
