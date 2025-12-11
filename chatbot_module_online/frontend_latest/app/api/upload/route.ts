import { NextResponse } from 'next/server';

// Force Node.js runtime for Buffer support (required for file handling)
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for large file uploads

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const patientId = formData.get('patientId');
    const file = formData.get('file') as File;

    if (!patientId || !file) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId and file' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Get backend URL from environment variable, fallback to default
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8000";
    
    if (!backendUrl || backendUrl === 'http://localhost:8000') {
      console.warn('[Upload API] Backend URL not configured, using localhost fallback');
    }
    
    console.log(`[Upload API] Proxying to backend: ${backendUrl}/embed/pdf`);
    console.log(`[Upload API] File: ${file.name}, Size: ${file.size} bytes, Patient: ${patientId}`);
    console.log(`[Upload API] Backend URL: ${backendUrl}`);
    console.log(`[Upload API] Environment check - NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'not set'}, API_URL: ${process.env.API_URL || 'not set'}`);
    
    // Validate backend URL format
    try {
      new URL(backendUrl);
    } catch (urlError) {
      console.error('[Upload API] Invalid backend URL:', backendUrl);
      return NextResponse.json(
        { 
          error: 'Configuration error', 
          message: 'Backend URL is not properly configured. Please set NEXT_PUBLIC_API_URL environment variable.'
        },
        { status: 500 }
      );
    }

    // Convert File to Buffer for Node.js serverless environment
    // In Vercel's serverless, we need to use Buffer for proper multipart encoding
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Manually construct multipart/form-data for reliable serverless compatibility
    const boundary = `----formdata-nextjs-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const CRLF = '\r\n';
    const parts: Buffer[] = [];
    
    // Add patient_id field
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="patient_id"${CRLF}${CRLF}` +
      `${patientId}${CRLF}`
    ));
    
    // Add file field
    const filename = file.name || 'document.pdf';
    const contentType = file.type || 'application/pdf';
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename.replace(/"/g, '\\"')}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
    
    const formDataBody = Buffer.concat(parts);

    // Proxy to FastAPI backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for large files
    
    let backendRes: Response;
    try {
      backendRes = await fetch(`${backendUrl}/embed/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formDataBody,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[Upload API] Request timeout');
        return NextResponse.json(
          { 
            error: 'Upload timeout', 
            message: 'The upload took too long. Please try with a smaller file or check your connection.'
          },
          { status: 504 }
        );
      }
      console.error('[Upload API] Fetch error:', fetchError);
      return NextResponse.json(
        { 
          error: 'Network error', 
          message: fetchError.message || 'Failed to connect to backend server. Please check if the backend is running.'
        },
        { status: 503 }
      );
    }

    if (!backendRes.ok) {
      // Try to parse error as JSON first, fallback to text
      let errorMessage = 'Upload failed';
      const contentType = backendRes.headers.get('content-type');
      
      try {
        if (contentType?.includes('application/json')) {
          const errorData = await backendRes.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } else {
          const errorText = await backendRes.text();
          // Try to extract meaningful error from HTML/text responses
          if (errorText.includes('detail')) {
            const match = errorText.match(/"detail":\s*"([^"]+)"/);
            errorMessage = match ? match[1] : errorText.substring(0, 200);
          } else {
            errorMessage = errorText.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.error('[Upload API] Failed to parse error response:', parseError);
        errorMessage = `Backend error: ${backendRes.status} ${backendRes.statusText}`;
      }
      
      console.error(`[Upload API] Backend error (${backendRes.status}):`, errorMessage);
      
      return NextResponse.json(
        { 
          error: 'Upload failed', 
          message: errorMessage,
          statusCode: backendRes.status 
        },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    console.log(`[Upload API] Upload successful: ${data.chunks_inserted || 0} chunks inserted`);
    
    // Return success response with file info
    return NextResponse.json({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      chunksInserted: data.chunks_inserted || 0,
      status: data.status || 'ok',
    });

  } catch (error) {
    console.error('[Upload API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Error processing upload', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

