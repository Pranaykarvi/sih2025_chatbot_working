"use client"

import { type FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ChatForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (payload: { topK: number; question: string }) => void
  disabled?: boolean
}) {
  const [topK, setTopK] = useState<string>("3")
  const [question, setQuestion] = useState<string>("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    onSubmit({ topK: Number(topK), question })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="topk">Top K results</Label>
        <Select value={topK} onValueChange={setTopK} disabled={disabled}>
          <SelectTrigger id="topk" aria-label="Top K results">
            <SelectValue placeholder="Select K (1-5)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="5">5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="question">Ask a medical question</Label>
        <Textarea
          id="question"
          placeholder="Type your question in simple words"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={5}
          disabled={disabled}
        />
      </div>

      <div className="flex">
        <Button type="submit" className="ml-auto" disabled={disabled}>
          Submit Question
        </Button>
      </div>
    </form>
  )
}
