
'use server';
/**
 * @fileOverview Parses a CV to extract key information and structure its content.
 *
 * - parseCv - A function that handles the CV parsing process.
 * - ParseCvInput - the input type for the parseCv function.
 * - ParseCvOutput - The return type for the parseCv function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  ParseCvInputSchema,
  ParseCvOutputSchema,
  type ParseCvOutput,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

export type { ParseCvOutput };

export async function parseCv(input: { cvText: string }): Promise<ParseCvOutput> {
  const now = new Date();
  const currentDate = now.toDateString();
  const experienceCalculatedAt = now.toISOString();
  const parseCvFlow = await createParseCvFlow();
  return parseCvFlow({ ...input, currentDate, experienceCalculatedAt });
}

const prompt = ai.definePrompt({
  name: 'parseCvPrompt',
  input: {schema: ParseCvInputSchema},
  output: {schema: ParseCvOutputSchema},
  prompt: `You are a world-class CV parsing engine. Your task is to meticulously analyze the provided CV text and extract key information into a structured JSON format.

**Extraction Rules:**

1.  **Unique Identifier**: You MUST extract the candidate's email address. This is the most critical field. If multiple emails are found, use the first one. It is absolutely essential that you find and return the email address.
2.  **Core Details**: Extract the candidate's full name, a contact phone number, and a URL to their LinkedIn profile if available. Format the name in Title Case.
3.  **Current Role**: Identify the candidate's most recent or current job title and company.
4.  **Total Experience**:
    *   You MUST calculate the total years of professional experience.
    *   For roles with an end date of "Present", "Current", or similar, use today's date ({{{currentDate}}}) for the calculation.
    *   Handle overlapping employment periods by merging them to avoid double-counting time. The total experience is the sum of unique, non-overlapping time periods.
    *   Return the experience as a string, e.g., "5.5 years". If you cannot calculate it, return null.
5.  **Structured Content**:
    *   **Summary**: Extract the professional summary or objective statement.
    *   **Experience**: Detail each work experience with job title, company, dates, and a list of responsibilities/achievements.
    *   **Education**: List all educational qualifications with degree, institution, and the year of completion or attendance dates. It is critical to capture the dates for each entry.
    *   **Skills**: Consolidate all technical and soft skills into a single list.
    *   **Projects**: If any projects are listed, extract their name, description, and technologies used. You MUST ensure that each project listed in the output is unique; do not include duplicate project entries.

Your final output must be a valid JSON object matching the provided schema. Do not add any commentary or text outside of the JSON structure.

CV Text:
{{{cvText}}}
`,
});

export async function createParseCvFlow() {
  return ai.defineFlow(
    {
      name: 'parseCvFlow',
      inputSchema: ParseCvInputSchema,
      outputSchema: ParseCvOutputSchema,
    },
    async input => {
      const {output} = await withRetry(() => prompt(input));
      if (!output) {
          throw new Error("CV parsing failed: The AI returned an empty or invalid response.");
      }
      // We no longer throw an error if email is missing, but the frontend will handle it.
      return output;
    }
  );
}
