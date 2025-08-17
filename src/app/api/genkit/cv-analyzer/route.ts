import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeCVAgainstJD } from '@/ai/flows/cv-analyzer';
import { ExtractJDCriteriaOutputSchema } from '@/lib/types';

const analyzeCVSchema = z.object({
  cv: z.string(),
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = analyzeCVSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await analyzeCVAgainstJD(parsedBody.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in cv-analyzer route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
