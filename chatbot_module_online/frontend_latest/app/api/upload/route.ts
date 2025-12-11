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

    // Create new FormData for backend
    const backendFormData = new FormData();
    backendFormData.append('patient_id', patientId as string);
    backendFormData.append('file', file);

    // Proxy to FastAPI backend
    // Note: Don't set Content-Type header - browser will set it with boundary for FormData
    const backendRes = await fetch(`${backendUrl}/embed/pdf`, {
      method: 'POST',
      body: backendFormData,
      // Explicitly don't set Content-Type - let browser set it with multipart/form-data boundary
    });

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

