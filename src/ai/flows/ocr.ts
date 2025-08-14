'use server';
/**
 * @fileOverview Performs Optical Character Recognition (OCR) on an image.
 *
 * - performOcr - A function that extracts text from a given image.
 * - OcrInput - The input type for the performOcr function.
 * - OcrOutput - The return type for the performOcr function.
 */

import {ai} from '@/ai/genkit';
import { OcrInputSchema, OcrOutputSchema, type OcrInput, type OcrOutput } from '@/lib/types';
import { withRetry } from '@/lib/retry';

export type { OcrInput, OcrOutput };

/**
 * Performs Optical Character Recognition (OCR) on an image.
 * @param input - The input containing the image data.
 * @returns A promise that resolves to the OcrOutput.
 */
export async function performOcr(input: OcrInput): Promise<OcrOutput> {
  const performOcrFlow = await createOcrFlow();
  return performOcrFlow(input);
}

const prompt = ai.definePrompt({
  name: 'ocrPrompt',
  input: {schema: OcrInputSchema},
  output: {schema: OcrOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are an Optical Character Recognition (OCR) expert. Extract all text from the following image. Preserve formatting like paragraphs and line breaks as much as possible.

Image:
{{media url=image}}`,
});

/**
 * Defines the Genkit flow for performing OCR.
 * This flow uses a prompt to extract text from a given image.
 * @returns A Genkit flow function.
 */
export async function createOcrFlow() {
  return ai.defineFlow(
    {
      name: 'performOcrFlow',
      inputSchema: OcrInputSchema,
      outputSchema: OcrOutputSchema,
    },
    async input => {
      const {output} = await withRetry(() => prompt(input));
      return output!;
    }
  );
}
