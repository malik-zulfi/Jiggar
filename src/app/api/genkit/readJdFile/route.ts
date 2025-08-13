import { NextRequest, NextResponse } from 'next/server';

const GENKIT_FLOW_URL = process.env.GENKIT_FLOW_URL || 'http://localhost:3400/readJdFile';

export async function POST(req: NextRequest) {
  try {
    const { fileName } = await req.json();

    const response = await fetch(GENKIT_FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Genkit API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error calling Genkit readJdFile flow:', error);
    return NextResponse.json({ error: error.message || 'Failed to call Genkit readJdFile flow' }, { status: 500 });
  }
}
