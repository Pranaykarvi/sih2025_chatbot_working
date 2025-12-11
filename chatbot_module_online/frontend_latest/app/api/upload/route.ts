import { NextResponse } from 'next/server';

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
    
    console.log(`[Upload API] Proxying to backend: ${backendUrl}/embed/pdf`);
    console.log(`[Upload API] File: ${file.name}, Size: ${file.size} bytes, Patient: ${patientId}`);
    console.log(`[Upload API] Backend URL: ${backendUrl}`);
    console.log(`[Upload API] Environment check - NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'not set'}, API_URL: ${process.env.API_URL || 'not set'}`);

    // Convert File to Blob for serverless compatibility
    // In Next.js serverless (Node.js), we need to convert File to Blob/Buffer
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([fileArrayBuffer], { type: file.type || 'application/pdf' });

    // Create FormData for backend - this works in both browser and Node.js
    const backendFormData = new FormData();
    backendFormData.append('patient_id', patientId as string);
    // Append as Blob with filename - this is compatible with both environments
    backendFormData.append('file', fileBlob, file.name);

    // Proxy to FastAPI backend with timeout
    // Note: Don't set Content-Type header - fetch will automatically set it with the correct boundary
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for large files
    
    let backendRes: Response;
    try {
      backendRes = await fetch(`${backendUrl}/embed/pdf`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal,
        // Let fetch set Content-Type automatically with boundary
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

