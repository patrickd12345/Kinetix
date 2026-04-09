import { useRef, useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { KINETIX_PERFORMANCE_SCORE } from '../lib/branding'
import { MessageCircle, Send, Trash2, Loader2 } from 'lucide-react'

export default function Chat() {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat()
  const [inputValue, setInputValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }

  return (
    <div className="pb-24 lg:pb-6 flex flex-col h-[calc(100vh-2rem)] max-h-[800px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle size={28} className="text-cyan-400" />
          Coach chat
        </h1>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="text-gray-400 hover:text-gray-300 text-sm flex items-center gap-1"
            aria-label="Clear chat history"
            title="Clear chat"
          >
            <Trash2 size={16} aria-hidden />
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col min-h-0">
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
        >
          {messages.length === 0 && !error && (
            <div className="text-center text-gray-500 py-12 px-4">
              <MessageCircle size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Ask about your training, pacing, {KINETIX_PERFORMANCE_SCORE}, or recovery.</p>
              <p className="text-xs mt-1">e.g. &quot;How should I pace my next 10K?&quot;</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                role="article"
                aria-label={m.role === 'user' ? 'You' : 'Coach'}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'user'
                    ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30'
                    : 'bg-white/10 text-gray-200 border border-white/10'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-cyan-400" />
                <span className="text-sm text-gray-400">Thinking…</span>
              </div>
            </div>
          )}
          {error && (
            <div
              className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-2"
              role="alert"
            >
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-white/10 flex gap-2"
          aria-label="Coach chat message"
        >
          <label htmlFor="coach-chat-input" className="sr-only">
            Message to coach
          </label>
          <input
            id="coach-chat-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Message the coach…"
            className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl px-4 py-3 flex items-center justify-center"
            aria-label="Send message"
          >
            <Send size={20} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  )
}
