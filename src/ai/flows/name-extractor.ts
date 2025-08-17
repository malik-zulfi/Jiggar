'use server';
/**
 * @fileOverview Extracts a candidate's full name from CV text.
 *
 * - extractCandidateName - A function that pulls the name from CV text.
 * - ExtractCandidateNameInput - The input type for the function.
 * - ExtractCandidateNameOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import {
  ExtractCandidateNameInputSchema,
  ExtractCandidateNameOutputSchema,
  type ExtractCandidateNameInput,
  type ExtractCandidateNameOutput,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

export type { ExtractCandidateNameInput, ExtractCandidateNameOutput };

/**
 * Extracts a candidate's full name from CV text.
 * @param input - The input containing the CV text.
 * @returns A promise that resolves to the ExtractCandidateNameOutput.
 */
export async function extractCandidateName(
  input: ExtractCandidateNameInput
): Promise<ExtractCandidateNameOutput> {
  const extractCandidateNameFlow = await createNameExtractorFlow();
  return extractCandidateNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractCandidateNamePrompt',
  input: { schema: ExtractCandidateNameInputSchema },
  output: { schema: ExtractCandidateNameOutputSchema },
  config: { temperature: 0.0 },
  prompt: `You are an expert CV parser. Your sole task is to extract the full name of the candidate from the following CV text. Format the name in Title Case (e.g., "John Doe"). Return only the name and nothing else. If you cannot determine the name, return an empty string.

CV Text:
{{{cvText}}}
`,
});

/**
 * Converts a string to Title Case.
 * @param str - The input string.
 * @returns The string in Title Case.
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Defines the Genkit flow for extracting a candidate's name.
 * This flow uses a prompt to extract the full name from CV text.
 * @returns A Genkit flow function.
 */
export function createNameExtractorFlow() {
  return ai.defineFlow(
    {
      name: 'extractCandidateNameFlow',
      inputSchema: ExtractCandidateNameInputSchema,
      outputSchema: ExtractCandidateNameOutputSchema,
    },
    async (input) => {
      const { output } = await withRetry(() => prompt(input));
      if (output) {
        return {
          candidateName: toTitleCase(output.candidateName),
        };
      }
      return { candidateName: '' };
    }
  );
}
