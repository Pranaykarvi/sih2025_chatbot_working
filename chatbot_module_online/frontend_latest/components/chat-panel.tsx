"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import ChatBubble from "./chat-bubble"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { askQuestion } from "@/lib/api"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  sources?: Array<{ pdf: string; chunkId: string | number; score: number }>
}

// Animated background SVG (brighter, more colorful)
const AnimatedBg = () => (
  <svg className="absolute inset-0 w-full h-full -z-10 animate-gradient-move" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0.25" />
      </radialGradient>
      <radialGradient id="g2" cx="80%" cy="20%" r="60%">
        <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#f87171" stopOpacity="0.15" />
      </radialGradient>
      <radialGradient id="g3" cx="20%" cy="80%" r="60%">
        <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
      </radialGradient>
    </defs>
    <circle cx="400" cy="300" r="350" fill="url(#g1)" />
    <circle cx="650" cy="100" r="200" fill="url(#g2)" />
    <circle cx="200" cy="500" r="180" fill="url(#g3)" />
  </svg>
)

export default function ChatPanel() {
  const [patientId, setPatientId] = useState("")
  const [topK, setTopK] = useState("3")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  /** After a few seconds, explain cold start so users don’t assume failure */
  const [showColdStartHint, setShowColdStartHint] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Ref for the input bar (type bar)
  const inputBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading) {
      setShowColdStartHint(false)
      return
    }
    const id = window.setTimeout(() => setShowColdStartHint(true), 6000)
    return () => {
      window.clearTimeout(id)
    }
  }, [loading])

  // Scrolls to the input bar (type bar) at the bottom
  function scrollToInputBar() {
    requestAnimationFrame(() => {
      inputBarRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    if (!patientId.trim()) {
      setError("Please enter a valid Patient ID.")
      return
    }

    setError(null)

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    // Scroll to input bar after user message
    scrollToInputBar()

    try {
      const data = await askQuestion({
        patientId: patientId.trim(),
        message: userMsg.text,
        topK: Number(topK),
      })

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text,
        sources: data.sources,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error("Chat error:", err)
      const errorMessage = err instanceof Error 
        ? err.message 
        : "There was an error generating a response. Please try again."
      
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: errorMessage,
      }
      setMessages((prev) => [...prev, aiMsg])
      setError(errorMessage)
    } finally {
      setLoading(false)
      // Scroll to input bar after assistant message
      scrollToInputBar()
    }
  }

  return (
    <div className="w-full h-[85vh] relative rounded-3xl shadow-2xl bg-gradient-to-br from-purple-50 via-pink-50 via-blue-50 to-cyan-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:via-blue-950/20 dark:to-cyan-950/20 border-2 border-purple-200/50 dark:border-purple-800/50 overflow-hidden perspective-3d animate-pulse-glow">
      {/* Animated 3D background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float-reverse"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-rotate-3d"></div>
      </div>
      
      <header className="relative px-6 py-5 border-b-2 border-purple-200/50 dark:border-purple-800/50 flex items-center gap-2 bg-gradient-to-r from-purple-500/80 via-pink-500/80 via-blue-500/80 to-cyan-500/80 dark:from-purple-600/60 dark:via-pink-600/60 dark:via-blue-600/60 dark:to-cyan-600/60 backdrop-blur-sm shadow-lg">
        <span className="text-3xl font-extrabold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent animate-gradient-shift">
          ✨ ArogyaLink Chatbot ✨
        </span>
        <span className="ml-auto text-xs font-semibold text-white/90 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          Ask a medical question based on uploaded records.
        </span>
      </header>
      {/* Message list is scrollable, input bar is absolutely fixed at bottom */}
      <div className="absolute inset-x-0 top-[88px] bottom-[120px] overflow-y-auto px-6 py-6 scroll-smooth" ref={listRef} role="list" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center space-y-4 animate-slide-in-up">
              <div className="text-6xl animate-bounce">💬</div>
              <p className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Your conversation will appear here
              </p>
              <p className="text-sm text-muted-foreground">Start chatting to see messages appear with beautiful animations!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, index) => (
              <div key={m.id} className="space-y-2 scroll-reveal" style={{ animationDelay: `${index * 0.1}s` }}>
                <ChatBubble role={m.role}>{m.text}</ChatBubble>
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <Accordion type="single" collapsible className="max-w-[85%]">
                    <AccordionItem value={`sources-${m.id}`}>
                      <AccordionTrigger className="text-sm">Sources</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-5 text-sm">
                          {m.sources.map((s, idx) => (
                            <li key={idx}>
                              <span className="font-medium">{s.pdf}</span>{" "}
                              <span className="text-muted-foreground">
                                (chunk {s.chunkId}, score {Number.isFinite(s.score) ? s.score.toFixed(3) : "—"})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            ))}
          </div>
        )}
        {loading && (
          <div className="mt-4 flex flex-col gap-2 pl-1 animate-slide-in-up max-w-xl">
            <div className="flex gap-2 items-center">
              <span className="h-3 w-3 animate-bounce rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg [animation-delay:-0.2s]" />
              <span className="h-3 w-3 animate-bounce rounded-full bg-gradient-to-r from-pink-500 to-blue-500 shadow-lg [animation-delay:-0.1s]" />
              <span className="h-3 w-3 animate-bounce rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg" />
              <span className="ml-2 text-sm font-medium bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                AI is thinking…
              </span>
              <span className="sr-only">Assistant is loading; please wait for the response</span>
            </div>
            {showColdStartHint && (
              <p className="text-xs text-muted-foreground leading-relaxed pl-1 border-l-2 border-purple-400/50 pl-3">
                First request after idle can take 1–2 minutes while the server wakes up. Please keep this tab open — the answer will appear here when ready.
              </p>
            )}
          </div>
        )}
        {/* Invisible div for scrolling to input bar */}
        <div ref={inputBarRef} />
      </div>
      {/* Input bar absolutely fixed at bottom */}
      <form onSubmit={onSubmit} className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-r from-purple-500/90 via-pink-500/90 via-blue-500/90 to-cyan-500/90 dark:from-purple-600/80 dark:via-pink-600/80 dark:via-blue-600/80 dark:to-cyan-600/80 backdrop-blur-md border-t-2 border-purple-300/50 dark:border-purple-700/50 shadow-2xl flex flex-col gap-3">
        {error && (
          <div className="bg-red-500/20 border-2 border-red-500/50 rounded-lg px-4 py-2 animate-slide-in-up">
            <p className="text-red-700 dark:text-red-300 text-sm font-semibold">⚠️ {error}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            id="chat_patient_id"
            className="flex-1 bg-white/90 dark:bg-gray-900/90 border-2 border-purple-300/50 dark:border-purple-700/50 rounded-xl px-4 py-3 font-medium shadow-lg hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 focus:ring-2 focus:ring-purple-500 focus:scale-105 click-bounce"
            placeholder="Patient ID (e.g., RURAL-12345)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <Input
            id="message"
            className="flex-1 bg-white/90 dark:bg-gray-900/90 border-2 border-purple-300/50 dark:border-purple-700/50 rounded-xl px-4 py-3 font-medium shadow-lg hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 focus:ring-2 focus:ring-purple-500 focus:scale-105 click-bounce"
            placeholder="Ask a medical question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <Select value={topK} onValueChange={setTopK}>
            <SelectTrigger className="w-24 bg-white/90 dark:bg-gray-900/90 border-2 border-purple-300/50 dark:border-purple-700/50 rounded-xl shadow-lg hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 click-bounce">
              <SelectValue placeholder="3" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-2 border-purple-300/50">
              {[1, 2, 3, 4, 5].map((k) => (
                <SelectItem key={k} value={String(k)} className="hover:bg-purple-100 dark:hover:bg-purple-900/50">
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            className="bg-gradient-to-r from-purple-600 via-pink-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-pink-700 hover:via-blue-700 hover:to-cyan-700 text-white font-bold shadow-2xl hover:shadow-purple-500/50 hover:scale-110 focus:ring-4 focus:ring-purple-400 focus:ring-offset-2 px-8 py-3 rounded-xl transition-all duration-300 transform hover:-translate-y-1 click-bounce animate-gradient-shift"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚡</span>
                Sending…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>🚀</span>
                Send
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
