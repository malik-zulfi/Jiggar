# Gemini Code Assistant Context

This document provides context for the Gemini Code Assistant to understand the Jiggar project.

## Project Overview

Jiggar is an intelligent recruitment assistant built with Next.js and Google's Genkit. It streamlines the hiring process by providing AI-powered analysis of Job Descriptions (JDs) and candidate CVs, helping to make faster, more informed hiring decisions.

The project uses a monolithic architecture with the frontend and backend code colocated in the same repository.

### Key Technologies:

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Generative AI**: [Google Genkit](https://firebase.google.com/docs/genkit) with the `gemini-1.5-flash` model.
- **UI**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [ShadCN UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React Context with `localStorage` for persistence.
- **Schema Validation**: [Zod](https://zod.dev/) is used for all data structures.

## Building and Running

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later recommended)
- `npm` (which comes with Node.js)

### Environment Variables

A `.env.local` file is required in the root of the project with the following content:

```
GOOGLE_API_KEY="your_api_key_here"
```

You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation

```bash
npm install
```

### Running the Application

The application requires two separate processes to be run in two different terminals:

**Terminal 1: Start the Next.js Frontend**

```bash
npm run dev
```

This will start the Next.js application, usually on `http://localhost:3000`.

**Terminal 2: Start the Genkit AI Server**

```bash
npm run genkit:dev
```

This starts the Genkit development server, which handles the AI-powered features. It provides a development UI, typically on `http://localhost:4000`, where you can inspect your AI flows.

### Other useful commands

- `npm run build`: Builds the application for production.
- `npm run start`: Starts a production server.
- `npm run lint`: Lints the codebase for errors.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.

## Development Conventions

- **AI Flows**: All Genkit-related code is located in the `src/ai` directory. Each AI agent flow is in its own file in the `src/ai/flows` directory.
- **Components**: Reusable React components are located in the `src/components` directory. UI components from ShadCN are in `src/components/ui`.
- **Types**: All Zod schemas and TypeScript types are defined in `src/lib/types.ts`.
- **Error Handling**: A `withRetry` utility is used to make robust AI calls.
- **State Management**: Global state is managed using React Context and is defined in `src/components/client-provider.tsx`.
- **Styling**: Tailwind CSS is used for styling. Utility classes are combined using the `cn` function from `src/lib/utils.ts`.
