const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('lib/ai/chatbot-service.ts', [
  [
    "        .limit(options.limit || 5),\n    );\n    \n    // Calculate cosine similarity (simplified)\n    const scored = results.map((doc) => {\n      const docEmbedding = JSON.parse(doc.embedding as unknown as string);\n      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);\n      \n      return {\n        documentId: doc.id,\n        title: doc.title,\n        relevanceScore: similarity,\n        excerpt: doc.content.substring(0, 200) + \"...\",\n      };\n    });\n    \n    // Filter by threshold and sort\n    return scored\n      .filter((r) => r.relevanceScore >= (options.similarityThreshold || 0.7))\n      .sort((a, b) => b.relevanceScore - a.relevanceScore);",
    "        // The limit applies to the best matches, not to the rows read: a bounded candidate set is scored first, so a relevant\n        // document is not lost because it was not among the first few rows the database returned.\n        .limit(RAG_CANDIDATE_CAP),\n    );\n\n    // Calculate cosine similarity; a row whose embedding is missing or unreadable cannot be scored and is skipped.\n    const scored = results.flatMap((doc) => {\n      let docEmbedding: number[];\n      try {\n        docEmbedding = typeof doc.embedding === 'string' ? JSON.parse(doc.embedding) : (doc.embedding as unknown as number[]);\n      } catch {\n        return [];\n      }\n      if (!Array.isArray(docEmbedding) || docEmbedding.length !== queryEmbedding.length) return [];\n      return [{\n        documentId: doc.id,\n        title: doc.title,\n        relevanceScore: cosineSimilarity(queryEmbedding, docEmbedding),\n        excerpt: doc.content.substring(0, 200) + \"...\",\n      }];\n    });\n\n    // Filter by threshold, order by relevance, then keep the requested number.\n    return scored\n      .filter((r) => r.relevanceScore >= (options.similarityThreshold ?? 0.7))\n      .sort((a, b) => b.relevanceScore - a.relevanceScore)\n      .slice(0, options.limit || 5);",
  ],
  [
    "          logger?.error('[ChatbotService] AI generation failed — returning fallback response', {\n            error: aiError instanceof Error ? aiError.message : String(aiError),\n            sessionId: data.sessionId,\n          });\n          generated = {\n            content:\n              \"I'm sorry, the AI assistant is temporarily unavailable. \" +\n              \"Please try again in a few moments. If the issue persists, \" +\n              \"contact your union representative for assistance.\",\n            tokensUsed: 0,\n            model: 'fallback',\n          };",
    "          // No canned text is stored as the assistant's reply: it would sit in the conversation, billed and counted as a model\n          // answer. The failure is raised, nothing is recorded, and the caller sees the service is unavailable.\n          logger?.error('[ChatbotService] AI generation failed', {\n            error: aiError instanceof Error ? aiError.message : String(aiError),\n            sessionId: data.sessionId,\n          });\n          throw new ChatbotUnavailableError();",
  ],
])
{
  const f = 'lib/ai/chatbot-service.ts'
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  const m = s.match(/^export class /m) || s.match(/^class /m)
  if (!m) throw new Error('no class anchor')
  s = s.slice(0, m.index) + `/** Upper bound on the knowledge rows scored for one question. */
const RAG_CANDIDATE_CAP = 500;

export class ChatbotUnavailableError extends Error {
  constructor() {
    super('The assistant is temporarily unavailable');
    this.name = 'ChatbotUnavailableError';
  }
}

` + s.slice(m.index)
  fs.writeFileSync(f, s)
}

edit('app/api/chatbot/messages/route.ts', [
  [
    "      const refused = operationAuditResponse(error);",
    "      if (error instanceof ChatbotUnavailableError) throw ApiError.externalService('ai-assistant', 'The assistant is temporarily unavailable. Please try again shortly.');\n      const refused = operationAuditResponse(error);",
  ],
])
console.log('ok')
