/**
 * GET PATCH DELETE /api/chatbot/sessions/[sessionId]/messages
 * -> Django ai_core: /api/ai_core/chat-sessions/
 * NOTE: auto-resolved from chatbot/sessions/[sessionId]/messages
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;
  return djangoProxy(req, '/api/ai_core/chat-sessions/' + sessionId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;
  return djangoProxy(req, '/api/ai_core/chat-sessions/' + sessionId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;
  return djangoProxy(req, '/api/ai_core/chat-sessions/' + sessionId + '/', { method: 'DELETE' });
}

