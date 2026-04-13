/**
 * Direct calls to the FastAPI backend (e.g. Render).
 * Routes match chatbot-backend routers: POST /chat/ask, POST /embed/pdf.
 */

const CHAT_ASK_PATH = "/chat/ask"
const EMBED_PDF_PATH = "/embed/pdf"

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!raw) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_URL. Add it in Vercel (Environment Variables) or frontend_latest/.env.local — e.g. https://sih2025-chatbot-working.onrender.com (no trailing slash)."
    )
  }
  return raw.replace(/\/+$/, "")
}

async function parseJsonBody<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("application/json")) {
    return null
  }
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await parseJsonBody<{
    detail?: string | Array<{ msg?: string }>
    message?: string
    error?: string
  }>(res)
  if (data) {
    const d = data.detail
    if (typeof d === "string") return d
    if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
      return String((d[0] as { msg?: string }).msg ?? fallback)
    }
    if (data.message) return data.message
    if (data.error) return data.error
  }
  try {
    const text = await res.text()
    if (text?.trim()) return text.slice(0, 500)
  } catch {
    /* ignore */
  }
  return `${fallback} (${res.status})`
}

export type AskQuestionInput = {
  patientId: string
  message: string
  topK?: number
}

export type AskQuestionSource = {
  pdf: string
  chunkId: string | number
  score: number
}

export type AskQuestionResult = {
  text: string
  sources: AskQuestionSource[]
}

/**
 * POST /chat/ask — RAG chat for a patient.
 */
export async function askQuestion(input: AskQuestionInput): Promise<AskQuestionResult> {
  const base = getApiBaseUrl()
  const url = `${base}${CHAT_ASK_PATH}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: input.patientId,
        question: input.message,
        top_k: input.topK ?? 3,
        use_cloud: true,
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    throw new Error(
      `Could not reach the backend at ${base}. Check NEXT_PUBLIC_API_URL and CORS. ${msg}`
    )
  }

  const data = await parseJsonBody<{
    answer?: string
    detail?: string
    sources?: Array<{ doc_id?: string; chunk_id?: number; score?: number }>
  }>(res)

  if (!res.ok) {
    const msg = data?.detail
      ? typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail)
      : await getErrorMessage(res, "Chat request failed")
    throw new Error(msg)
  }

  if (!data) {
    throw new Error("Invalid or empty response from chat service.")
  }

  const text = data.answer?.trim()
  if (!text) {
    throw new Error("The assistant returned an empty answer.")
  }

  const sources: AskQuestionSource[] = (data.sources ?? []).map((s) => ({
    pdf: s.doc_id ?? "",
    chunkId: s.chunk_id ?? "",
    score: typeof s.score === "number" ? s.score : 0,
  }))

  return { text, sources }
}

export type UploadDocumentInput = {
  patientId: string
  file: File
}

export type UploadDocumentResult = {
  name: string
  size: number
  lastModified: number
  chunksInserted: number
  status: string
  warning?: string
}

/**
 * POST /embed/pdf — multipart form: patient_id, file (FastAPI field names).
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const base = getApiBaseUrl()
  const url = `${base}${EMBED_PDF_PATH}`

  const formData = new FormData()
  formData.append("patient_id", input.patientId)
  formData.append("file", input.file)

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      body: formData,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    throw new Error(
      `Could not reach the backend at ${base}. Check NEXT_PUBLIC_API_URL. ${msg}`
    )
  }

  const data = await parseJsonBody<{
    status?: string
    chunks_inserted?: number
    detail?: string
    warning?: string
  }>(res)

  if (!res.ok) {
    const msg = data?.detail
      ? typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail)
      : await getErrorMessage(res, "Upload failed")
    throw new Error(msg)
  }

  if (!data) {
    throw new Error("Invalid or empty response from upload service.")
  }

  return {
    name: input.file.name,
    size: input.file.size,
    lastModified: input.file.lastModified,
    chunksInserted: data.chunks_inserted ?? 0,
    status: data.status ?? "ok",
    warning: data.warning,
  }
}
