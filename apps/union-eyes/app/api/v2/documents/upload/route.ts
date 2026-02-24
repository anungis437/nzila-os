/**
 * POST /api/documents/upload
 * Migrated to withApi() framework
 */

import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const ALLOWED_MIME_TYPES_LIST = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const _documentUploadSchema = z.object({
  file: z.object({
    name: z.string().min(1, "File name is required"),
    size: z.number().max(MAX_FILE_SIZE, "File size exceeds 50MB limit"),
    type: z.enum(ALLOWED_MIME_TYPES_LIST as unknown as [string, ...string[]], {
      errorMap: () => ({ message: "Invalid file type" })
    })
  }),
  organizationId: z.string().uuid("Invalid organization ID"),
  folderId: z.string().uuid("Invalid folder ID").optional(),
  name: z.string().max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
  category: z.string().max(100).optional(),
  isConfidential: z.boolean().optional(),
  accessLevel: z.enum(["public", "private", "restricted", "confidential"]).optional()
});

import { POST as v1POST } from '@/app/api/documents/upload/route';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.DOCUMENT_UPLOAD,
    openapi: {
      tags: ['Documents'],
      summary: 'POST upload',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
