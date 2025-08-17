import { handleError } from './error-handler';
import {
  AnalyzeCVAgainstJDInput,
  AnalyzeCVAgainstJDOutput,
} from '@/ai/flows/cv-analyzer';
import {
  ExtractJDCriteriaInput,
  ExtractJDCriteriaOutput,
} from '@/ai/flows/jd-analyzer';
import {
  CandidateSummaryInput,
  CandidateSummaryOutput,
} from '@/ai/flows/candidate-summarizer';
import {
  FindSuitablePositionsInput,
  FindSuitablePositionsOutput,
} from '@/ai/flows/find-suitable-positions';

export async function analyzeCV(
  input: AnalyzeCVAgainstJDInput
): Promise<AnalyzeCVAgainstJDOutput | null> {
  try {
    const response = await fetch('/api/genkit/cv-analyzer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze CV');
    }

    return await response.json();
  } catch (error) {
    handleError(error);
    return null;
  }
}

export async function analyzeJD(
  input: ExtractJDCriteriaInput
): Promise<ExtractJDCriteriaOutput | null> {
  try {
    const response = await fetch('/api/genkit/jd-analyzer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze JD');
    }

    return await response.json();
  } catch (error) {
    handleError(error);
    return null;
  }
}

export async function summarizeCandidate(
  input: CandidateSummaryInput
): Promise<CandidateSummaryOutput | null> {
  try {
    const response = await fetch('/api/genkit/candidate-summarizer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to summarize candidate');
    }

    return await response.json();
  } catch (error) {
    handleError(error);
    return null;
  }
}

export async function findSuitablePositions(
  input: FindSuitablePositionsInput
): Promise<FindSuitablePositionsOutput | null> {
  try {
    const response = await fetch('/api/genkit/findSuitablePositions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to find suitable positions');
    }

    return await response.json();
  } catch (error) {
    handleError(error);
    return null;
  }
}
