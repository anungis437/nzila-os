const fs = require('fs')
const f = 'lib/ai/__tests__/chatbot-service.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
// The ai-client mock had no buildOrgAiTrace, so every generate call threw and the tests passed on the canned fallback reply.
swap('  getAiClient: vi.fn(() => ({\n    generate: mocks.mockAiGenerate,', '  buildOrgAiTrace: () => ({}),\n  getAiClient: vi.fn(() => ({\n    generate: mocks.mockAiGenerate,')
const start = s.indexOf('  it("sendMessage handles AI error with fallback"')
const end = s.indexOf('\n  it(', start + 10)
const endIdx = end === -1 ? s.length : end
const replacement = `  // Replaced: this test asserted that a failed generation was stored as an assistant reply from the model "fallback". The ai-client mock also
  // lacked buildOrgAiTrace, so the other sendMessage tests were passing on that canned reply; the mock now provides it.
  // DEF-0B4-CHATBOT-FALLBACK-PRESENTED-AS-AI-REPLY
  it("sendMessage raises when generation fails and stores no reply", async () => {
    mocks.mockSelectLimit
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([]);
    mocks.mockAiGenerate.mockRejectedValueOnce(new Error("AI down"));
    await expect(bot.sendMessage({
      sessionId: "sess-1",
      userId: "user-1",
      organizationId: "org-1",
      content: "Hello",
    })).rejects.toBeInstanceOf(ChatbotUnavailableError);
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });
`
s = s.slice(0, start) + replacement + s.slice(endIdx)
fs.writeFileSync(f, s)
console.log('ok')
