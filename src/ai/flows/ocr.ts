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

export async function performOcr(input: OcrInput): Promise<OcrOutput> {
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

const performOcrFlow = ai.defineFlow(
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
