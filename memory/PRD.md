# Interview Preparation Website - PRD

## Problem Statement
Build a clean, minimalist, responsive Interview Preparation Website with an AI-powered study assistant (OpenAI GPT-5.2). Features: domain-based Q&A, difficulty filters, code syntax highlighting, AI chatbot, and admin CRUD panel. Tri-mode theming: Light/Dark/Warm.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) 
- **Database**: MongoDB (Motor async driver)
- **AI**: OpenAI GPT-5.2 via Emergent Integrations
- **Auth**: JWT httpOnly cookies

## User Personas
1. **Job Seeker** - Browses domains, reads Q&A, uses AI chatbot for doubt-solving
2. **Admin (Owner)** - Manages domains and questions via admin dashboard

## Core Requirements
- Landing page with search + domain grid
- Domain page with difficulty/most-asked filters
- Q&A accordion with Markdown + code syntax highlighting
- AI chatbot (context-aware, interview coach guardrails)
- Admin panel: login, analytics, domain CRUD, question CRUD
- Tri-mode theming: Light / Dark / Warm

## What's Been Implemented (May 17, 2026)
- [x] Full backend API (auth, domains, questions, search, AI chat, analytics)
- [x] Seed data: 6 domains, 13 questions with rich markdown answers
- [x] JWT auth with httpOnly cookies
- [x] Landing page with search bar + domain grid
- [x] Domain page with All/Easy/Medium/Hard/Most Asked filters
- [x] Accordion Q&A with react-markdown + syntax highlighting
- [x] AI Chat drawer using Shadcn Sheet + OpenAI GPT-5.2
- [x] Admin login + protected dashboard
- [x] Admin analytics cards
- [x] Admin Domain CRUD (table + dialog)
- [x] Admin Question CRUD (table + dialog with select, switch, textarea)
- [x] Tri-mode theming (Light/Dark/Warm) with localStorage persistence
- [x] 100% test pass rate (19/19 backend, all frontend flows)

## Prioritized Backlog
### P0 (Done)
- All core features implemented and tested

### P1 (Next)
- Brute force protection on login (5-fail lockout)
- Chat history persistence per user session
- Pagination for questions list
- Rich text editor for admin question answers

### P2 (Future)
- User accounts (non-admin learners)
- Bookmarked questions
- Progress tracking
- Export questions to PDF
- Analytics dashboard with charts
