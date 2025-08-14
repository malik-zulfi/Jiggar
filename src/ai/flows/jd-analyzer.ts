'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow extracts
 * all relevant information from a JD into a highly structured format.
 *
 * - extractJDCriteria - A function that handles the JD criteria extraction process.
 * - ExtractJDCriteriaInput - The input type for the extractJDCriteria function.
 * - ExtractJDCriteriaOutput - The return type for the extractJDCriteria function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { 
    ExtractJDCriteriaOutputSchema, 
    type ExtractJDCriteriaOutput,
    RequirementGroupSchema,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';
import { randomUUID } from 'crypto';

const ExtractJDCriteriaInputSchema = z.object({
  jobDescription: z.string().describe('The Job Description to analyze.'),
});
export type ExtractJDCriteriaInput = z.infer<typeof ExtractJDCriteriaInputSchema>;

export type { ExtractJDCriteriaOutput };

const jdCache = new Map<string, ExtractJDCriteriaOutput>();

/**
 * Extracts all relevant information from a Job Description (JD) into a highly structured format.
 * Implements caching to avoid redundant AI calls for the same JD text.
 * @param input - The input containing the job description text.
 * @returns A promise that resolves to the ExtractJDCriteriaOutput.
 */
export async function extractJDCriteria(input: ExtractJDCriteriaInput): Promise<ExtractJDCriteriaOutput> {
  const cacheKey = input.jobDescription;
  if (jdCache.has(cacheKey)) {
    return jdCache.get(cacheKey)!;
  }

  const extractJDCriteriaFlow = await createExtractJDCriteriaFlow();
  const result = await extractJDCriteriaFlow(input);
  jdCache.set(cacheKey, result);
  return result;
}

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPromptV4',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: ExtractJDCriteriaOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruitment data analyst. Your task is to meticulously deconstruct a job description into a structured JSON format.

**Instructions:**

1.  **Full Extraction**: You MUST extract information for every field in the provided JSON schema.
2.  **"Not Found"**: If you cannot find information for a specific field, you MUST use the string "Not Found" for that field.
3.  **Prioritization**: You must infer the priority of each requirement (MUST_HAVE or NICE_TO_HAVE).
4.  **Grouped Requirements**: For requirements like Education and Certifications, you must group them logically (e.g., multiple degrees under one educational entry).
5.  **Experience**: You must extract the required years of experience and the specific fields of experience.

---
**Job Description:**
{{{jobDescription}}}
---

Now, analyze the job description and return the full JSON object.
`
});

/**
 * Creates a Genkit flow for extracting structured data from a Job Description.
 * This flow uses a prompt to extract the data and includes retry logic.
 * @returns A Genkit flow function.
 */
async function createExtractJDCriteriaFlow() {
  return ai.defineFlow(
    {
      name: 'extractJDCriteriaFlow',
      inputSchema: ExtractJDCriteriaInputSchema,
      outputSchema: ExtractJDCriteriaOutputSchema,
    },
    async (input) => {
      const { output } = await withRetry(() => prompt(input));
      return output;
    }
  );
}
