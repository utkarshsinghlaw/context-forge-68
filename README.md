# Context Forge 68

The operating system for knowledge work. Context before AI — grounded, cited answers scoped to your own workspaces.

## Overview
Context Forge is a full-stack, AI-native knowledge management application built to help users organize, search, and extract insights from their documents, notes, and meeting transcripts. 

The application utilizes a Retrieval-Augmented Generation (RAG) architecture to ensure that the AI only answers questions using the secure, grounded context provided by your own workspaces.

## Key Features

### Three Layers of Memory
Context Forge implements a sophisticated 3-tier memory system so the AI understands you and your data:
1. **Long-term Vector Memory**: Documents, notes, and meeting transcripts are automatically chunked and embedded (pgvector), forming a persistent Knowledge Graph for RAG.
2. **Session Working Memory**: The AI maintains an active, rolling summary of your current session's interactions and queries to maintain high-context conversational flow.
3. **Workspace Context**: Every project exists within an isolated Workspace, ensuring AI boundaries are strictly maintained per project.

### Model-Agnostic AI Architecture
The application is designed without vendor lock-in. While it natively utilizes OpenAI's /v1/chat/completions and /v1/embeddings schemas by default, the underlying AI gateway architecture can easily be pointed to any OpenAI-compatible proxy, open-source model, or unified API (e.g. Gemini, Anthropic) with minimal payload adjustments.

### Real-Time Speech Transcription
Built-in live session capabilities utilizing the Deepgram SDK v5. Record your meetings, thoughts, or brainstorming sessions directly in the browser; the audio is transcribed in real-time, instantly chunked, and vectorized into the RAG Knowledge Graph. 

### Granular Document Management
- **Documents & Notes**: Upload files or write rich-text notes that are automatically vectorized.
- **Auto-Indexing**: Zero-configuration indexing. Every save or upload automatically syncs to the vector database.

## Tech Stack
- **Framework**: [TanStack Start](https://tanstack.com/start) (React Router v7)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, pgvector)
- **AI Integration**: Standardized around [OpenAI](https://openai.com) schemas (gpt-4o-mini and text-embedding-3-small)
- **Transcription**: [Deepgram](https://deepgram.com) API for live speech-to-text
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)

## Local Development

1. Install dependencies:
   npm install

2. Configure your environment variables in a .env file. You will need:
   - Supabase URL and Anon Key
   - OPENAI_API_KEY
   - DEEPGRAM_API_KEY and DEEPGRAM_PROJECT_ID

3. Start the development server:
   npm run dev
