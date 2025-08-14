import { config } from 'dotenv';
config();

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

import { queryKnowledgeBase } from './flows/query-knowledge-base';

// Import other flows to ensure they are registered
import './flows/cv-analyzer';
import './flows/jd-analyzer';
import './flows/candidate-summarizer';
import './flows/ocr';
import './flows/name-extractor';
import './flows/cv-parser';
import './flows/find-suitable-positions';

export default genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
  
  
  
});