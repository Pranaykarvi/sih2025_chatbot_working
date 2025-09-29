"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import ChatBubble from "./chat-bubble"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  sources?: Array<{ pdf: string; chunkId: string; score: number }>
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
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function scrollToEnd() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
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
    scrollToEnd()

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          patientId,
          topK: Number(topK),
        }),
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const data = await res.json()
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text ?? "I could not generate a response.",
        sources: data.sources ?? [],
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error(err)
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "There was an error generating a response. Please try again.",
      }
      setMessages((prev) => [...prev, aiMsg])
    } finally {
      setLoading(false)
      scrollToEnd()
    }
  }

  return (
    <div className="w-full h-[70vh] flex flex-col rounded-2xl shadow-2xl bg-gradient-to-br from-white via-blue-100 to-pink-100 dark:from-background dark:via-accent/30 dark:to-primary/20 border border-border overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center gap-2 bg-gradient-to-r from-pink-200/60 via-blue-200/60 to-green-200/60 dark:from-accent/30 dark:to-primary/10">
        <span className="text-2xl font-bold text-accent">ArogyaLink Chatbot</span>
        <span className="ml-auto text-xs text-muted-foreground">Ask a medical question based on uploaded records.</span>
      </header>
      <main className="flex-1 flex flex-col gap-0 p-0">
        <div className="flex-1 overflow-y-auto px-6 py-4" ref={listRef} role="list" aria-live="polite">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-10 text-center">Your conversation will appear here.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className="space-y-2">
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
                                  (chunk {s.chunkId}, score {s.score.toFixed(3)})
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
            <div className="mt-3 flex gap-1 pl-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-green-400" />
              <span className="sr-only">Assistant is typing</span>
            </div>
          )}
        </div>
      </main>
      <form onSubmit={onSubmit} className="p-6 bg-gradient-to-r from-pink-100/60 via-blue-100/60 to-green-100/60 dark:from-background dark:to-accent/10 border-t border-border flex flex-col gap-3">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="chat_patient_id"
            className="flex-1"
            placeholder="Patient ID (e.g., RURAL-12345)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <Input
            id="message"
            className="flex-1"
            placeholder="Ask a medical question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <Select value={topK} onValueChange={setTopK}>
            <SelectTrigger className="w-20">
              <SelectValue placeholder="3" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((k) => (
                <SelectItem key={k} value={String(k)}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            className="bg-gradient-to-r from-pink-500 via-blue-500 to-green-500 text-white font-bold shadow-lg hover:scale-105 focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 px-8 py-2 transition-all duration-300"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}
