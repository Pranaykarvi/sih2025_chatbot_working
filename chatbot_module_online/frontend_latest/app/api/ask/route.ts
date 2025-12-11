
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { message, patientId, topK } = await req.json()

    if (!message || !patientId) {
      return NextResponse.json(
        { error: "Missing required fields: message and patientId" },
        { status: 400 }
      )
    }

    // Get backend URL from environment variable, fallback to default
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8000"
    
    console.log(`[API Route] Proxying to backend: ${backendUrl}/chat/ask`)
    console.log(`[API Route] Request data:`, { patient_id: patientId, question: message.substring(0, 50) + "...", top_k: topK ?? 3 })
    
    // Proxy to FastAPI backend
    const backendRes = await fetch(`${backendUrl}/chat/ask`, {
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
      // Try to parse error as JSON first, fallback to text
      let errorMessage = "There was an error contacting the backend.";
      const contentType = backendRes.headers.get('content-type');
      
      try {
        if (contentType?.includes('application/json')) {
          const errorData = await backendRes.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await backendRes.text();
          // Try to extract meaningful error from HTML/text responses
          if (errorText.includes('detail')) {
            const match = errorText.match(/"detail":\s*"([^"]+)"/);
            errorMessage = match ? match[1] : errorText.substring(0, 200);
          } else if (errorText.includes('Cannot POST')) {
            errorMessage = "Backend route not found. Please ensure the backend server is running correctly.";
          } else {
            errorMessage = errorText.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.error('[API Route] Failed to parse error response:', parseError);
        errorMessage = `Backend error: ${backendRes.status} ${backendRes.statusText}`;
      }
      
      console.error(`[API Route] Backend error (${backendRes.status}):`, errorMessage);
      
      return NextResponse.json(
        {
          text: errorMessage,
          sources: [],
          error: errorMessage,
          statusCode: backendRes.status,
        },
        { status: backendRes.status }
      )
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
  } catch (error) {
    console.error("[API Route] Unexpected error:", error)
    return NextResponse.json(
      {
        text: "An unexpected error occurred. Please try again.",
        sources: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
