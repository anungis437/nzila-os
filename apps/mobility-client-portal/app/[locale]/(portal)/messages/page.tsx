/**
 * Client Portal — Messages
 *
 * Secure messaging between client and advisor.
 */
export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  // TODO: Replace with real client-scoped query
  const messages = [
    { id: 'm-001', from: 'Sarah Nkemelu (Advisor)', date: '2026-03-09 14:30', body: 'Hi Jean-Pierre, we need your certified bank statements for the Malta application. Please upload them in the Documents section.' },
    { id: 'm-002', from: 'You', date: '2026-03-09 15:12', body: 'Thank you Sarah. I will get those from my bank this week. Should they cover the last 6 or 12 months?' },
    { id: 'm-003', from: 'Sarah Nkemelu (Advisor)', date: '2026-03-09 16:45', body: 'Last 6 months is sufficient for Malta MPRP. Make sure they show the minimum balance of €500,000 in liquid assets.' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">Secure communication with your advisor</p>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {messages.map((msg) => {
          const isAdvisor = !msg.from.startsWith('You')
          return (
            <div
              key={msg.id}
              className={`p-4 rounded-xl max-w-[80%] ${
                isAdvisor
                  ? 'bg-white border border-[var(--border)]'
                  : 'bg-[var(--primary)] text-white ml-auto'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${isAdvisor ? 'text-gray-500' : 'text-blue-200'}`}>
                  {msg.from}
                </span>
                <span className={`text-xs ${isAdvisor ? 'text-gray-400' : 'text-blue-200'}`}>
                  {msg.date}
                </span>
              </div>
              <p className={`text-sm ${isAdvisor ? 'text-gray-700' : 'text-white'}`}>{msg.body}</p>
            </div>
          )
        })}
      </div>

      {/* Compose */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <textarea
          placeholder="Type your message..."
          rows={3}
          className="w-full text-sm border-0 focus:outline-none resize-none placeholder-gray-400"
        />
        <div className="flex justify-end mt-2">
          <button className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
