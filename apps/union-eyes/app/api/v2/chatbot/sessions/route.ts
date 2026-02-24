/**
 * GET POST /api/chatbot/sessions
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
      summary: 'GET sessions',
      description: 'Proxied to Django: /api/ai_core/chat-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/chat-sessions/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Chatbot', 'Django Proxy'],
      summary: 'POST sessions',
      description: 'Proxied to Django: /api/ai_core/chat-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/chat-sessions/', { method: 'POST' });
    return response;
  },
);
