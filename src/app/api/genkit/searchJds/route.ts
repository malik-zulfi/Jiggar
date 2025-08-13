import { NextRequest, NextResponse } from 'next/server';

const GENKIT_FLOW_URL = process.env.GENKIT_FLOW_URL || 'http://localhost:3400/searchJds';

export async function POST(req: NextRequest) {
  try {
    const { searchQuery } = await req.json();

    const response = await fetch(GENKIT_FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchQuery }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Genkit API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error calling Genkit searchJds flow:', error);
    return NextResponse.json({ error: error.message || 'Failed to call Genkit searchJds flow' }, { status: 500 });
  }
}
