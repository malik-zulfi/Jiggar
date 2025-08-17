import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findSuitablePositionsForCandidate } from '@/ai/flows/find-suitable-positions';
import { CvDatabaseRecordSchema, AssessmentSessionSchema } from '@/lib/types';

const findSuitablePositionsSchema = z.object({
  candidates: z.array(CvDatabaseRecordSchema),
  assessmentSessions: z.array(AssessmentSessionSchema),
  existingSuitablePositions: z.array(z.object({
    candidateEmail: z.string(),
    candidateName: z.string(),
    assessment: AssessmentSessionSchema,
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = findSuitablePositionsSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await findSuitablePositionsForCandidate(parsedBody.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in findSuitablePositions route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
