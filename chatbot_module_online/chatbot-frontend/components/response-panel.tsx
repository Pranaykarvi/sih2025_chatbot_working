"use client"

import { Card, CardContent } from "@/components/ui/card"

export type SourceItem = {
  fileName: string
  chunkId: number
  score: number
}

export function ResponsePanel({
  responseText,
  sources,
  fallback = "No data found. Please upload a record first.",
}: {
  responseText: string
  sources: SourceItem[]
  fallback?: string
}) {
  const hasAnswer = Boolean(responseText && responseText.trim().length > 0)

  if (!hasAnswer) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{fallback}</div>
  }

  return (
    <div className="flex flex-col gap-4" aria-live="polite" role="status">
      <Card className="rounded-lg">
        <CardContent className="pt-4">
          <p className="text-pretty leading-relaxed">{responseText}</p>
        </CardContent>
      </Card>

      {sources.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 font-medium">Document Sources</div>
          <ul className="divide-y">
            {sources.map((s, idx) => (
              <li key={`${s.fileName}-${s.chunkId}-${idx}`} className="px-4 py-3 text-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.fileName}</span>
                    <span className="text-muted-foreground">Score: {s.score.toFixed(2)}</span>
                  </div>
                  <div className="text-muted-foreground">Chunk ID: {s.chunkId}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
