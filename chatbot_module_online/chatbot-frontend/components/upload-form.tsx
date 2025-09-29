"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function UploadForm({
  onSubmit,
}: {
  onSubmit: (payload: { patientId: string; fileName: string }) => void
}) {
  const [patientId, setPatientId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!patientId || !file) return
    setSubmitting(true)
    // In a real app, upload the file here (server action / route handler).
    // We only pass the metadata to parent for UI demo.
    onSubmit({ patientId, fileName: file.name })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="patient-id">Patient ID</Label>
        <Input
          id="patient-id"
          placeholder="Enter Patient ID"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="record-file">Medical Record (PDF)</Label>
        <Input
          id="record-file"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div className="flex">
        <Button type="submit" className="ml-auto" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload Record"}
        </Button>
      </div>
    </form>
  )
}
