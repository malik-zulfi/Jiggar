# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Jiggar is an AI-powered candidate assessment platform built with Next.js and Google's Genkit. It streamlines recruitment by providing intelligent analysis of Job Descriptions (JDs) and candidate CVs, helping make faster and more informed hiring decisions.

**Tech Stack:**

- Frontend: Next.js 15 (App Router), React 18, TypeScript
- AI/ML: Google Genkit with Gemini 2.5 Flash model
- UI: ShadCN UI components, Tailwind CSS
- State: React Context with encrypted localStorage persistence
- Schema: Zod for all data structures and validation

## Development Commands

### Essential Development Workflow

```bash
# Install dependencies
npm install

# Set up environment (copy .env.example to .env.local and add GOOGLE_API_KEY)
# Get key from: https://aistudio.google.com/app/apikey

# Start development (requires 2 terminals)
# Terminal 1: Next.js frontend
npm run dev

# Terminal 2: Genkit AI server
npm run genkit:dev
```

### Additional Commands

```bash
# Build for production
npm build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint

# Alternative Genkit server with file watching
npm run genkit:watch
```

### Ports

- Next.js app: http://localhost:3000
- Genkit dev UI: http://localhost:4000

## Code Architecture

### High-Level Structure

**Dual-Server Architecture:**

- Next.js frontend handles UI and routing
- Separate Genkit server manages AI operations and flows
- Communication via API routes and fetch calls

**State Management:**

- Global state via React Context (`ClientProvider`)
- Encrypted localStorage persistence for data privacy
- Three main data stores: Assessment Sessions, CV Database, Suitable Positions

### Key Directories

```
src/
├── ai/                     # Genkit AI server and flows
│   ├── flows/              # Individual AI agent flows
│   ├── genkit.ts           # Genkit configuration
│   └── dev.ts              # Development server entry
├── app/                    # Next.js App Router pages
│   ├── assessment/         # JD analysis and CV assessment UI
│   ├── cv-database/        # Central candidate database
│   └── notifications/      # Suitable position notifications
├── components/             # React components
│   ├── ui/                 # ShadCN UI primitives
│   └── client-provider.tsx # Global state management
└── lib/
    ├── types.ts            # All Zod schemas and TypeScript types
    ├── secure-storage.ts   # Encrypted localStorage wrapper
    └── utils.ts            # Utility functions
```

### AI Flow Architecture

**Core AI Flows (in src/ai/flows/):**

- `jd-analyzer.ts` - Parses Job Descriptions into structured requirements
- `cv-parser.ts` - Extracts structured data from candidate CVs
- `cv-analyzer.ts` - Matches candidates against JD requirements
- `candidate-summarizer.ts` - Generates tier-based candidate summaries
- `find-suitable-positions.ts` - Identifies relevant positions for candidates
- `query-knowledge-base.ts` - Powers the global chatbot interface

**Flow Communication:**

- Flows are registered in `dev.ts` and exposed via Next.js API routes
- Frontend calls flows via fetch to `/api/genkit/[flowName]`
- All inputs/outputs defined by Zod schemas in `types.ts`

### Data Models

**Three Primary Data Structures:**

1. **AssessmentSession** - Represents a JD analysis with candidate assessments
2. **CvDatabaseRecord** - Centralized candidate profiles with structured CV data
3. **SuitablePosition** - Cross-references between candidates and relevant jobs

**Key Features:**

- All schemas use Zod for runtime validation
- Automatic job code tagging (OCN, WEX, SAN)
- Experience calculation with temporal tracking
- Edit tracking for human modifications

### State Persistence

**Encrypted Storage:**

- Uses `crypto-js` AES encryption for localStorage data
- Three storage keys: history, CV database, suitable positions
- Automatic save/load with schema validation
- Import/export functionality with replace/append modes

## Development Patterns

### AI Flow Development

- Each flow is a separate file with clear input/output schemas
- Use `withRetry` utility for robust AI calls
- All flows registered in `dev.ts` for hot reloading
- Test flows via Genkit dev UI at localhost:4000

### Component Patterns

- ShadCN UI components in `/components/ui/`
- Business components use `cn()` utility for Tailwind class merging
- Global state access via `useAppContext()` hook
- Error boundaries for graceful failure handling

### Type Safety

- All data structures defined as Zod schemas first
- TypeScript types inferred from Zod schemas
- Runtime validation at API boundaries
- Schema evolution tracked with migration logic

## Environment Setup

**Required Environment Variables:**

```bash
GOOGLE_API_KEY="your_gemini_api_key_here"
```

**Development Dependencies:**

- Node.js 20+ required
- Genkit CLI installed via devDependencies
- Husky for Git hooks (commit linting)

**Code Quality:**

- ESLint with Next.js and Prettier configs
- Conventional commit messages via commitlint
- TypeScript strict mode enabled
