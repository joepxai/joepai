'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Chat = {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
}

type Mode = 'chat' | 'image'

const MODELS = [
  { id: 'glm-4-flash', name: 'GLM-4-Flash（免费）' },
  { id: 'glm-4v-flash', name: 'GLM-4V-Flash 视觉（免费）' },
]

function generateId() {
  return Math.random().toString(36).slice(2)
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('chat')
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('glm-4-flash')
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('joepai-chats')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setChats(parsed)
        if (parsed.length > 0) setCurrentChatId(parsed[0].id)
      } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('joepai-chats', JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats, currentChatId])

  const currentChat = chats.find(c => c.id === currentChatId)

  function newChat() {
    const chat: Chat = {
      id: generateId(),
      title: '新对话',
      messages: [],
      model: selectedModel,
      createdAt: Date.now(),
    }
    setChats(prev => [chat, ...prev])
    setCurrentChatId(chat.id)
    setMode('chat')
    setImageUrl(null)
    setInput('')
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    let chatId = currentChatId
    let chat = chats.find(c => c.id === chatId)

    if (!chat) {
      const newC: Chat = {
        id: generateId(),
        title: input.slice(0, 20) || '新对话',
        messages: [],
        model: selectedModel,
        createdAt: Date.now(),
      }
      setChats(prev => [newC, ...prev])
      setCurrentChatId(newC.id)
      chatId = newC.id
      chat = newC
    }

    const userMsg: Message = { role: 'user', content: input }
    const updatedMessages = [...(chat.messages || []), userMsg]

    setChats(prev => prev.map(c =>
      c.id === chatId
        ? { ...c, messages: updatedMessages, title: c.messages.length === 0 ? input.slice(0, 20) : c.title }
        : c
    ))
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, model: selectedModel }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      // Add empty assistant message
      setChats(prev => prev.map(c =>
        c.id === chatId
          ? { ...c, messages: [...updatedMessages, { role: 'assistant', content: '' }] }
          : c
      ))

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content || ''
              assistantText += delta
              setChats(prev => prev.map(c =>
                c.id === chatId
                  ? { ...c, messages: [...updatedMessages, { role: 'assistant', content: assistantText }] }
                  : c
              ))
            } catch {}
          }
        }
      }
    } catch {
      setChats(prev => prev.map(c =>
        c.id === chatId
          ? { ...c, messages: [...updatedMessages, { role: 'assistant', content: '❌ 请求失败，请重试' }] }
          : c
      ))
    } finally {
      setLoading(false)
    }
  }

  async function generateImage() {
    if (!imagePrompt.trim() || loading) return
    setLoading(true)
    setImageUrl(null)
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      })
      const data = await res.json()
      if (data.url) setImageUrl(data.url)
      else setImageUrl(null)
    } catch {
      alert('图片生成失败')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (mode === 'chat') sendMessage()
      else generateImage()
    }
  }

  return (
    <div className="flex h-screen bg-[#F7F3EE] text-[#2D2D2D] font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} transition-all duration-300 bg-[#EDE8E0] flex flex-col border-r border-[#D8D0C4] shrink-0`}>
        <div className="p-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-[#1A1A1A]">JoePAI</span>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={newChat}
            className="w-full text-left px-3 py-2 rounded-xl bg-[#D6CFC4] hover:bg-[#C8C0B4] transition text-sm font-medium flex items-center gap-2"
          >
            <span>✏️</span> 新对话
          </button>
        </div>

        <nav className="px-3 py-2 space-y-1">
          <button
            onClick={() => setMode('chat')}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition ${mode === 'chat' ? 'bg-[#C8C0B4] font-medium' : 'hover:bg-[#D6CFC4]'}`}
          >
            <span>💬</span> 对话
          </button>
          <button
            onClick={() => setMode('image')}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition ${mode === 'image' ? 'bg-[#C8C0B4] font-medium' : 'hover:bg-[#D6CFC4]'}`}
          >
            <span>🎨</span> 绘画
          </button>
        </nav>

        <div className="px-3 py-2 mt-2 border-t border-[#D8D0C4]">
          <p className="text-xs text-gray-400 px-3 py-1 uppercase tracking-wide">历史对话</p>
          <div className="space-y-1 mt-1 max-h-80 overflow-y-auto">
            {chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => { setCurrentChatId(chat.id); setMode('chat') }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm truncate transition ${currentChatId === chat.id ? 'bg-[#C8C0B4] font-medium' : 'hover:bg-[#D6CFC4]'}`}
              >
                {chat.title || '新对话'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4 text-xs text-gray-400">
          Powered by 智谱 AI
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center px-4 py-3 border-b border-[#D8D0C4] bg-[#F7F3EE] gap-3">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700 mr-1">
              ☰
            </button>
          )}
          {!sidebarOpen && <span className="font-bold text-lg">JoePAI</span>}

          {mode === 'chat' && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="ml-auto text-sm bg-[#EDE8E0] border border-[#D8D0C4] rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {mode === 'image' && (
            <span className="ml-auto text-sm text-gray-500 bg-[#EDE8E0] px-3 py-1.5 rounded-lg">
              🎨 CogView-3-Flash（免费）
            </span>
          )}
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'chat' && (
            <div className="max-w-2xl mx-auto px-4 py-8">
              {!currentChat || currentChat.messages.length === 0 ? (
                <div className="text-center mt-20">
                  <h1 className="text-4xl font-bold text-[#1A1A1A] mb-3">你好，我是 JoePAI</h1>
                  <p className="text-gray-500 text-lg">有什么我可以帮你的？</p>
                </div>
              ) : (
                <div className="space-y-6 pb-4">
                  {currentChat.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-[#8B7355] text-white flex items-center justify-center text-sm mr-3 shrink-0 mt-0.5">
                          J
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-[#8B7355] text-white rounded-tr-sm'
                            : 'bg-white border border-[#E0D8CF] rounded-tl-sm shadow-sm'
                        }`}
                      >
                        {msg.content || (loading && i === currentChat.messages.length - 1 ? (
                          <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                          </span>
                        ) : '')}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}

          {mode === 'image' && (
            <div className="max-w-2xl mx-auto px-4 py-8 text-center">
              <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2">AI 绘画</h1>
              <p className="text-gray-500 mb-8">描述你想要的画面，AI 帮你生成</p>
              {imageUrl && (
                <div className="mb-6">
                  <img src={imageUrl} alt="生成的图片" className="rounded-2xl shadow-lg max-w-full mx-auto" /> {/* eslint-disable-line @next/next/no-img-element */}
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 mt-2 inline-block hover:underline">
                    查看原图 ↗
                  </a>
                </div>
              )}
              {loading && !imageUrl && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-12 h-12 border-4 border-[#8B7355] border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 text-sm">正在生成图片...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[#D8D0C4] bg-[#F7F3EE] px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 bg-white border border-[#D8D0C4] rounded-2xl px-4 py-3 shadow-sm focus-within:border-[#8B7355] transition">
              <textarea
                ref={textareaRef}
                value={mode === 'chat' ? input : imagePrompt}
                onChange={e => mode === 'chat' ? setInput(e.target.value) : setImagePrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'chat' ? '发消息…（Enter 发送，Shift+Enter 换行）' : '描述想要的画面…（Enter 生成）'}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none leading-relaxed max-h-40 overflow-y-auto"
                style={{ minHeight: '24px' }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = t.scrollHeight + 'px'
                }}
              />
              <button
                onClick={mode === 'chat' ? sendMessage : generateImage}
                disabled={loading || (mode === 'chat' ? !input.trim() : !imagePrompt.trim())}
                className="w-8 h-8 bg-[#8B7355] text-white rounded-xl flex items-center justify-center hover:bg-[#7A6448] disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
              >
                {loading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">JoePAI 由智谱 AI 免费模型驱动</p>
          </div>
        </div>
      </main>
    </div>
  )
}
