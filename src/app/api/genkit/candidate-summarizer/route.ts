import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { summarizeCandidateAssessments } from '@/ai/flows/candidate-summarizer';
import {
  CandidateAssessmentSchema,
  ExtractJDCriteriaOutputSchema,
} from '@/lib/types';

const summarizeCandidateSchema = z.object({
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema,
  candidateAssessments: z.array(CandidateAssessmentSchema),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = summarizeCandidateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await summarizeCandidateAssessments(parsedBody.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in candidate-summarizer route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
