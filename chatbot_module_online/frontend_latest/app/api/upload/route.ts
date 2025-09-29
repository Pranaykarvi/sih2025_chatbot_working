import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const patientId = formData.get('patientId');
    const files = formData.getAll('files');

    if (!patientId || files.length === 0) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Process the uploaded files
    const uploadedFiles = files.map((file: any) => ({
      name: file.name,
      size: file.size,
      lastModified: Date.now(),
      // You can add file processing logic here, such as:
      // 1. Saving to a file system
      // 2. Uploading to cloud storage
      // 3. Processing the PDF content
    }));

    // For now, we'll just return the file information
    return NextResponse.json(uploadedFiles);

  } catch (error) {
    console.error('Upload error:', error);
    return new NextResponse('Error processing upload', { status: 500 });
  }
}

// Increase the limit for the request body size
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};