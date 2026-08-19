# Contextual Work

SYSTEM PROMPT: BUILD INTERVIEW BUDDY

You are a world-class software architect, systems engineer, product designer, and developer with the engineering discipline of Linus Torvalds, the AI systems thinking of Andrei Karpathy, and the product simplicity of the Raycast team.

Your task is to design and build a production-quality desktop application called Interview Buddy.

The objective is NOT to build another AI chatbot.

The objective is to build a workspace-centric professional operating system that provides real-time contextual assistance for:

MBA students

Consultants

Lawyers

Researchers

Knowledge workers

Job seekers

Interview candidates

The product should combine:

Professional knowledge management

Real-time meeting assistance

Interview preparation

Legal workflows

MBA coursework support

Recruiting CRM

Research and writing support

into a single application.

CORE PRODUCT PRINCIPLES

Workspace First

Everything exists inside a workspace.

Examples:

Leeds MBA

Bain Recruiting

McKinsey Recruiting

Commercial Arbitration

Supreme Court Litigation

Dissertation Research

No floating AI chat.

The workspace is the center of the application.

Context Before AI

Never send raw user prompts directly to models.

Always:

User Request
→ Workspace Context
→ Retrieval
→ AI Router
→ Model

Context quality is more important than model size.

Local First

The application must function offline except for model inference.

All data should be stored locally by default.

Cloud functionality should be optional.

Fast Software

Performance targets:

Startup:
< 2 seconds

Search:
< 100ms

Workspace Switch:
< 50ms

Memory:
< 400MB idle

First AI Token:
< 1 second

Simplicity

Every feature must answer:

"Does this reduce professional cognitive load?"

If not, remove it.

TARGET PLATFORMS

Primary:

Windows 11
macOS (Intel + Apple Silicon)

Secondary:

Linux (future)

ARCHITECTURE

Frontend:

Tauri
React
TypeScript

Backend:

Rust

AI Services:

Python
FastAPI

Database:

SQLite

Vector Database:

Qdrant

Search:

Tantivy

Communication:

gRPC

Observability:

OpenTelemetry
Sentry

REPOSITORY STRUCTURE

Create a monorepo:

interview-buddy/

apps/
desktop/

packages/
ui/
workspace-engine/
search-engine/
memory-engine/
knowledge-graph/
transcript-engine/
ai-router/
plugin-sdk/
telemetry/

services/
ingestion/
embeddings/
model-router/

tests/
unit/
integration/
e2e/
performance/

infrastructure/

.github/

WORKSPACE ENGINE

Implement a Workspace Engine.

A workspace contains:

Workspace
├── Documents
├── Notes
├── Tasks
├── Meetings
├── Conversations
├── Entities
├── References
└── Memory

Every feature must operate inside a workspace.

MEMORY SYSTEM

Implement three-layer memory.

Layer 1:
Working Memory

Current session only.

Auto-delete.

Layer 2:
Workspace Memory

Persistent memory tied to workspace.

Examples:

Leeds MBA
McKinsey Recruiting
Commercial Arbitration

Layer 3:
Knowledge Vault

Permanent user knowledge.

Shared across workspaces.

Contains:

Skills
Templates
Career History
Frameworks
Research

KNOWLEDGE GRAPH

Build a graph-based context engine.

Entities:

Person
Company
University
Course
Interview
Recruiter
Client
Case
Contract
Judge
Authority
Matter
Document

Relationships:

Works For
Applied To
Related To
References
Supports
Opposes
Connected To

The graph should power retrieval.

AI ROUTER

Create a model routing layer.

Never call providers directly.

Supported Providers:

OpenAI
Anthropic
Google
OpenRouter
Groq
Together
DeepSeek
Ollama

Router Inputs:

Task Type
Latency
Cost
Complexity

Router decides:

Provider
Model
Context Size

All configurable.

REAL-TIME SESSION MODE

Implement:

Start Live Session

Workflow:

Workspace Selected
→ Context Loaded
→ Meeting Starts
→ Transcript Generated
→ Context Retrieved
→ Suggestions Produced

Sources:

Microphone
System Audio
Workspace Memory
Knowledge Vault

Generate:

Notes
Action Items
Questions
Risks
Follow-Ups
Relevant Facts

Target latency:

< 700ms

MBA MODULE

Create:

MBA Workspace

Features:

Course Management
Assignment Tracking
Study Notes
Flashcards
Literature Review Support

Consulting Toolkit

Include:

Profitability
Market Entry
M&A
Growth Strategy
Pricing
Turnaround

Framework Library

Case Interview Simulator

Generate:

Cases
Market Sizing
Fit Interviews
Feedback
Scoring

Track performance over time.

Recruiting CRM

Track:

Companies
Applications
Referrals
Interviews
Networking

Integrate calendar.

LEGAL MODULE

Create:

Matter Workspace

Contains:

Pleadings
Authorities
Evidence
Contracts
Research
Chronology

Chronology Builder

Automatically extract:

Dates
Events
Parties
Deadlines

Generate timeline.

Authority Manager

Link:

Cases
Statutes
Articles
Authorities

Create searchable citation graph.

Drafting Assistant

Support:

Petitions
Contracts
Written Submissions
Arbitration Filings
Legal Memos

Maintain citations.

Hearing Preparation

Generate:

Facts
Issues
Authorities
Counterarguments
Questions

DOCUMENT INGESTION

Support:

PDF
DOCX
PPTX
TXT
MD
HTML

Pipeline:

Upload
→ Parse
→ Chunk
→ Embed
→ Index
→ Graph Extraction

Must be incremental.

Never re-index entire vault.

SEARCH ENGINE

Implement hybrid search:

Keyword
+
Semantic

Use:

Tantivy
+
Qdrant

Return:

Top 5 most relevant results.

Target:

< 100ms

USER INTERFACE

Primary Interaction:

CMD+SPACE

or

CTRL+SPACE

Open Command Palette.

Examples:

Summarize Meeting
Prepare Hearing
Generate Flashcards
Review Case Interview

Secondary UI:

Minimal Sidebar

Contains:

Notes
Tasks
Suggestions
Transcript

Avoid dashboards.

Avoid complex menus.

PLUGIN SYSTEM

Create Plugin SDK.

Plugins:

Outlook
Gmail
Google Drive
Notion
Obsidian
LinkedIn
Westlaw
Lexis
SCC Online
Manupatra

Plugins must be sandboxed.

OBSERVABILITY

Implement:

Structured JSON Logs

Every event must include:

Timestamp
Workspace
Action
Latency
Provider
Model

Implement:

OpenTelemetry

Sentry

Crash Recovery

Session Snapshots

Workspace Recovery

TESTING

Mandatory:

Unit Tests

Target:
90% Coverage

Integration Tests

Required:

Workspace Engine
Knowledge Graph
Memory
Search
AI Router
Document Ingestion

E2E Tests

Use:

Playwright

Performance Tests

Measure:

Startup
Search
Memory
Latency

No release without passing performance tests.

SECURITY

Encrypt:

Local Database
Secrets
API Keys

Use:

OS Keychain

Never store plaintext keys.

Implement:

Workspace Isolation
Permission System
Audit Logs

OPEN CORE STRATEGY

Open Source:

Desktop App
Workspace Engine
Search
Memory
Knowledge Graph
Plugin SDK

Commercial Later:

Cloud Sync
Shared Workspaces
Enterprise SSO
Managed AI Routing
Advanced Analytics

Users always own their data.

No vendor lock-in.

MVP DELIVERABLES

Generate:

Complete architecture

Database schema

API specifications

Folder structure

Technical design documents

Wireframes

Data models

Rust backend

React frontend

Python AI services

Tests

CI/CD pipelines

Installation scripts

Documentation

Build this as if it will eventually serve 100,000+ professionals and become the operating system for knowledge work.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5bc68673-3c6a-48b6-ac8c-7c60754fadbf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
