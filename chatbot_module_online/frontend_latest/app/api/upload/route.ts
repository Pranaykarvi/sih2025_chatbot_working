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
    // Priority: NEXT_PUBLIC_API_URL > API_URL > hardcoded Render URL > localhost
    const backendUrl = process.env.NEXT_PUBLIC_API_URL 
      || process.env.API_URL 
      || "https://sih2025-chatbot-working.onrender.com"  // Fallback to Render backend
      || "http://localhost:8000";
    
    if (!process.env.NEXT_PUBLIC_API_URL && !process.env.API_URL) {
      console.warn('[Upload API] Backend URL not configured in environment variables, using hardcoded Render URL fallback');
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

    // Check file size limit (50MB for Vercel)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File too large', 
          message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 50MB.`
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Node.js serverless environment
    // In Vercel's serverless, we need to use Buffer for proper multipart encoding
    let fileBuffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } catch (bufferError) {
      console.error('[Upload API] Failed to read file buffer:', bufferError);
      return NextResponse.json(
        { 
          error: 'File read error', 
          message: 'Failed to read file. Please try again.'
        },
        { status: 500 }
      );
    }
    
    // Manually construct multipart/form-data for reliable serverless compatibility
    const boundary = `----formdata-nextjs-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const CRLF = '\r\n';
    const parts: Buffer[] = [];
    
    try {
      // Add patient_id field
      parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="patient_id"${CRLF}${CRLF}` +
        `${String(patientId)}${CRLF}`
      ));
      
      // Add file field
      const filename = (file.name || 'document.pdf').replace(/"/g, '\\"');
      const contentType = file.type || 'application/pdf';
      parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
        `Content-Type: ${contentType}${CRLF}${CRLF}`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
    } catch (formError) {
      console.error('[Upload API] Failed to construct form data:', formError);
      return NextResponse.json(
        { 
          error: 'Form data error', 
          message: 'Failed to prepare file for upload. Please try again.'
        },
        { status: 500 }
      );
    }
    
    let formDataBody: Buffer;
    try {
      formDataBody = Buffer.concat(parts);
    } catch (concatError) {
      console.error('[Upload API] Failed to concatenate form data:', concatError);
      return NextResponse.json(
        { 
          error: 'File processing error', 
          message: 'File is too large or corrupted. Please try with a smaller file.'
        },
        { status: 500 }
      );
    }

    // Proxy to FastAPI backend with timeout (110 seconds to be under maxDuration)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000); // 110 seconds
    
    let backendRes: Response;
    try {
      // Convert Buffer to Uint8Array for proper TypeScript compatibility
      const bodyArray = new Uint8Array(formDataBody);
      
      backendRes = await fetch(`${backendUrl}/embed/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyArray,
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

