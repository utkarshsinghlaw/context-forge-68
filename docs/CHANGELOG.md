# Changelog - August 22, 2026

## Features
- **Meetings Entity added**: Scaffolding for a new 'Meetings' tab, featuring transcript capabilities.
- **Deepgram Upgrade**: Upgraded integration to Deepgram SDK v5 with native exception handling.
- **OpenAI Migration**: Fully detached the application from the Lovable AI Gateway proxy. Pointed AI calls natively to \pi.openai.com\.

## Fixes
- **Routing**: Added missing \Link\ import in Meetings Panel to fix React router crash.
- **CSRF**: Added TanStack CreateCsrfMiddleware in \src/start.ts\ to protect Server Functions.
- **Live Session auth headers**: Fixed syntax error in \Authorization: Bearer\ string literal causing Bearer ReferenceError.
- **RAG Indexing**: Rewrote \eindexWorkspace\ and \indexSource\ to query and parse \meetings\ transcripts, fixing "Nothing has been indexed yet" errors and properly feeding transcripts into the LLM Knowledge Graph.

## Chore
- **Lovable Removal**: Deleted \src/lib/lovable-error-reporting.ts\, \src/integrations/lovable\, and refactored Google OAuth login in \src/routes/auth.tsx\ to use native Supabase auth.
