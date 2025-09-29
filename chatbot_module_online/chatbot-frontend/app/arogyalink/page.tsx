"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Stethoscope } from "lucide-react"
import { UploadForm } from "@/components/upload-form"
import { ChatForm } from "@/components/chat-form"
import { ResponsePanel, type SourceItem } from "@/components/response-panel"

export default function ArogyaLinkPage() {
  const [patientId, setPatientId] = useState<string>("")
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [responseText, setResponseText] = useState<string>("")
  const [sources, setSources] = useState<SourceItem[]>([])
  const hasRecord = Boolean(uploadedFileName)

  function handleUploadRecord({
    patientId,
    fileName,
  }: {
    patientId: string
    fileName: string
  }) {
    setPatientId(patientId)
    setUploadedFileName(fileName)
    // Reset previous response when a new record is uploaded
    setResponseText("")
    setSources([])
  }

  function handleAskQuestion({
    topK,
    question,
  }: {
    topK: number
    question: string
  }) {
    // For demo purposes, simulate a simple answer and mock sources if a record exists.
    if (!hasRecord) {
      setResponseText("")
      setSources([])
      return
    }

    const baseAnswer =
      "Here is a simple, easy-to-understand explanation based on the uploaded record. If symptoms get worse, please visit a clinic."
    setResponseText(baseAnswer)

    // Create deterministic mock sources using the uploaded file name and topK.
    const mock: SourceItem[] = Array.from({ length: topK }).map((_, idx) => ({
      fileName: uploadedFileName || "record.pdf",
      chunkId: idx + 1,
      score: Number((1 - idx * 0.1).toFixed(2)),
    }))
    setSources(mock)
  }

  return (
    <main className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <header className="mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-balance text-2xl font-semibold leading-tight md:text-3xl">ArogyaLink</h1>
            <p className="text-sm text-muted-foreground">Simple medical answers for rural communities</p>
          </div>
        </div>
      </header>

      {/* Content layout: mobile-first stack, enhances to 2 columns on md+ */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left column: Upload + Chat */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>PDF Upload</CardTitle>
              <CardDescription>Add your medical record PDF using the Patient ID.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm onSubmit={handleUploadRecord} />
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Ask ArogyaLink</CardTitle>
              <CardDescription>Choose how many results to use and ask your question.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChatForm onSubmit={handleAskQuestion} disabled={!hasRecord} />
              {!hasRecord && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground">No data found. Please upload a record first.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Response panel */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>AI-generated answer and sources</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsePanel
              responseText={responseText}
              sources={sources}
              fallback="No data found. Please upload a record first."
            />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
