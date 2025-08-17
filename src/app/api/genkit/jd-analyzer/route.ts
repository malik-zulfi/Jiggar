import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractJDCriteria } from '@/ai/flows/jd-analyzer';

const analyzeJDSchema = z.object({
  jobDescription: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = analyzeJDSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await extractJDCriteria(parsedBody.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in jd-analyzer route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
