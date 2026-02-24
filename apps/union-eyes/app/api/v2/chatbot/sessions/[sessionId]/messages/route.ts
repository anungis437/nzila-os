/**
 * GET PATCH DELETE /api/chatbot/sessions/[sessionId]/messages
 * → Django: /api/ai_core/chat-sessions/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Chatbot', 'Django Proxy'],
      summary: 'GET messages',
      description: 'Proxied to Django: /api/ai_core/chat-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/chat-sessions/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Chatbot', 'Django Proxy'],
      summary: 'PATCH messages',
      description: 'Proxied to Django: /api/ai_core/chat-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/chat-sessions/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Chatbot', 'Django Proxy'],
      summary: 'DELETE messages',
      description: 'Proxied to Django: /api/ai_core/chat-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/chat-sessions/', { method: 'DELETE' });
    return response;
  },
);
