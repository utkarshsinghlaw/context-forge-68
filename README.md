# Context Forge 68

The operating system for knowledge work. Context before AI — grounded, cited answers scoped to your own workspaces.

## Overview
Context Forge is a full-stack, AI-native knowledge management application built to help users organize, search, and extract insights from their documents, notes, and meeting transcripts. 

The application utilizes a Retrieval-Augmented Generation (RAG) architecture to ensure that the AI only answers questions using the secure, grounded context provided by your own workspaces.

## Tech Stack
- **Framework**: [TanStack Start](https://tanstack.com/start) (React Router)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, pgvector)
- **AI Models**: Native integration with [OpenAI](https://openai.com) (\gpt-4o-mini\ and \	ext-embedding-3-small\)
- **Speech-to-Text**: [Deepgram](https://deepgram.com) SDK v5 for real-time meeting transcription
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)

## Local Development

1. Install dependencies:
   \\\ash
   npm install
   \\\

2. Configure your environment variables in a \.env\ file. You will need:
   - Supabase URL and Anon Key
   - \OPENAI_API_KEY\
   - \DEEPGRAM_API_KEY\ and \DEEPGRAM_PROJECT_ID\

3. Start the development server:
   \\\ash
   npm run dev
   \\\

## Features
- **Workspaces**: Isolate your knowledge graphs by project or context.
- **Documents & Notes**: Upload files or write rich-text notes that are automatically vectorized.
- **Meetings**: Record live meetings with Deepgram speech-to-text, which are then chunked and embedded alongside your documents.
- **AI RAG Assistant**: Ask questions and get cited answers drawn strictly from your workspace data.
