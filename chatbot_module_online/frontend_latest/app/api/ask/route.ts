
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { message, patientId, topK } = await req.json()

  // Proxy to FastAPI backend
  const backendRes = await fetch("http://127.0.0.1:8000/chat/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: patientId,
      question: message,
      top_k: topK ?? 3,
      use_cloud: true,
    }),
  })

  if (!backendRes.ok) {
    return NextResponse.json({
      text: "There was an error contacting the backend.",
      sources: [],
    }, { status: 500 })
  }

  const data = await backendRes.json()

  // Map backend response to frontend format
  return NextResponse.json({
    text: data.answer,
    sources: (data.sources || []).map((s: any) => ({
      pdf: s.doc_id,
      chunkId: s.chunk_id,
      score: s.score,
    })),
  })
}
