# Product Requirements Document
**Product Name:** Creator Fusion MCP Server
**Version:** 1.0
**Last Updated:** 2026-02-05
**Author:** Jon (Creator Fusion LLC)
**Status:** Draft

---

## 1. Executive Summary

The Creator Fusion MCP Server exposes the YouTube Creator Analyzer's analysis engine as a set of MCP (Model Context Protocol) tools that AI agents can call in real time. Instead of running batch jobs through Apify, AI assistants like Claude, ChatGPT, and custom agents will be able to analyze YouTube creators, generate rate cards, detect sponsorships, and validate engagement authenticity — all through natural language conversations.

This positions Creator Fusion as infrastructure in the AI agent ecosystem, creates a new distribution channel beyond the Apify marketplace, and turns the existing analysis modules into a composable API that both humans and AI can use.

---

## 2. Problem Statement & Opportunity

**Current state:** The YouTube Creator Analyzer only runs as an Apify actor — a batch job that users trigger manually, wait for results, then export. There is no way for AI agents to call Creator Fusion's analysis tools directly during a conversation or workflow.

**Pain points:**
- Brands using AI assistants for creator discovery can't access Creator Fusion data without leaving their workflow
- The Apify marketplace limits distribution to users who already know Apify
- No real-time, conversational access to analysis — everything is batch
- AI agent platforms (Claude MCP, OpenAI plugins, custom agents) are a fast-growing distribution channel that Creator Fusion isn't in

**Market opportunity:** MCP is becoming the standard protocol for AI-to-tool communication. Anthropic, Apify, and dozens of companies are building MCP ecosystems. Being an early mover with a high-quality creator analytics MCP server positions Creator Fusion in a growing market with low competition. Most existing YouTube MCP tools are raw data scrapers — none offer composite scoring, sponsorship detection, or rate cards.

**Why now:** The MCP ecosystem is in its growth phase. Early servers get built into workflows and become sticky. Waiting means competing against established tools later.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target | Timeline |
|------|--------|--------|----------|
| Launch MCP server | Server published and callable | Working server with all tools | 2 weeks |
| AI platform presence | Listed on MCP registries | At least 2 registries (Anthropic, Apify) | 1 month |
| Usage | Tool calls per week | 100+ calls/week | 3 months |
| Revenue | Paid tier conversions | 10+ paying users | 6 months |
| Brand awareness | GitHub stars + forks | 50+ stars | 3 months |

---

## 4. Target Users & Personas

**Persona 1: AI-Assisted Brand Marketer (Primary)**
- Uses Claude/ChatGPT daily for work
- Needs to evaluate creators for campaigns mid-conversation
- Pain: Currently has to leave their AI assistant, go to a separate tool, run analysis, come back
- Goal: "Analyze @mkbhd for our Q3 campaign" → instant results in chat

**Persona 2: Developer Building Creator Tools**
- Building an influencer marketing platform or agency tool
- Wants to integrate creator analytics into their AI agent or app
- Pain: Building scoring/analysis from scratch is expensive
- Goal: Plug in Creator Fusion as a module via MCP

**Persona 3: Creator/Manager Self-Analyzing**
- Uses AI assistants for business planning
- Wants to understand their own metrics and benchmark against others
- Pain: No conversational way to get personalized channel analysis
- Goal: "How does my channel compare to others in my tier?"

---

## 5. User Stories & Use Cases

**US-1:** As a brand marketer using Claude, I want to say "analyze these 5 YouTube creators for our fitness campaign" and get Creator Fusion Scores, engagement metrics, and rate cards in my chat, so I can make creator selection decisions without leaving my workflow.

**US-2:** As a developer, I want to call `analyze_channel` with a YouTube handle and get structured JSON back, so I can integrate creator scoring into my own application.

**US-3:** As a brand marketer, I want to say "compare @mkbhd and @LinusTechTips for a tech product launch" and get a side-by-side comparison with scores, rates, and sponsorship history.

**US-4:** As a creator, I want to say "generate a rate card for my channel" and get a professional pricing document I can share with brands.

**US-5:** As a developer, I want to call `detect_sponsorships` on a channel to get just the sponsorship data without running the full analysis pipeline, so I can build focused features.

**US-6:** As a brand marketer, I want to ask "find me creators in the gaming niche with CF Scores above 70 and engagement above 3%" using filters, so I can narrow down my shortlist.

---

## 6. Functional Requirements

### FR-001: analyze_channel Tool
- **Description:** Full analysis pipeline for a single YouTube channel. Returns Creator Fusion Score™, engagement analytics, partnership insights, sponsorship detection, authenticity score, and rate card.
- **Input:** `channelInput` (string — URL, @handle, or channel ID), `videosToAnalyze` (int, default 30), `enableSponsorship` (bool, default true), `enableAuthenticity` (bool, default true), `enableRateCard` (bool, default true)
- **Output:** Full structured result matching the existing Apify output schema
- **Acceptance Criteria:** Returns valid JSON with all requested modules within 10 seconds for a single channel
- **Priority:** Must Have

### FR-002: compare_channels Tool
- **Description:** Analyze multiple channels and return a structured comparison table
- **Input:** `channels` (string[], 2–10 channels), same optional params as FR-001
- **Output:** Array of results + comparison summary (who scores highest, best engagement, best value rate)
- **Acceptance Criteria:** Returns comparison for 2–10 channels, with summary ranking
- **Priority:** Must Have

### FR-003: get_rate_card Tool
- **Description:** Generate a sponsorship rate card for a channel without the full analysis pipeline
- **Input:** `channelInput` (string)
- **Output:** Rate card with integration, dedicated, Shorts, and usage rights pricing
- **Acceptance Criteria:** Returns rate card within 5 seconds
- **Priority:** Must Have

### FR-004: detect_sponsorships Tool
- **Description:** Scan a channel's recent videos for sponsorship indicators only
- **Input:** `channelInput` (string), `videosToScan` (int, default 30)
- **Output:** Sponsorship data: detected brands, promo codes, disclosure compliance, sponsorship rate
- **Acceptance Criteria:** Returns sponsorship data within 5 seconds
- **Priority:** Should Have

### FR-005: check_authenticity Tool
- **Description:** Run engagement authenticity analysis only
- **Input:** `channelInput` (string), `videosToAnalyze` (int, default 30)
- **Output:** Authenticity score (0–100), flags, signals
- **Acceptance Criteria:** Returns authenticity report within 5 seconds
- **Priority:** Should Have

### FR-006: get_creator_score Tool
- **Description:** Quick Creator Fusion Score™ lookup — the most common single request
- **Input:** `channelInput` (string)
- **Output:** Score (0–100), grade (A+ to F), tier, breakdown
- **Acceptance Criteria:** Returns score within 3 seconds
- **Priority:** Must Have

### FR-007: API Key Management
- **Description:** The server must accept a YouTube Data API key either via environment variable (`YOUTUBE_API_KEY`) or as a parameter in the tool call
- **Input:** API key via env var or tool param
- **Acceptance Criteria:** Works with env var; tool-level key overrides env var if provided
- **Priority:** Must Have

### FR-008: Quota Reporting
- **Description:** Every response includes quota usage for that call and estimated remaining daily quota
- **Output:** `{ quotaUsed: number, estimatedRemaining: number }`
- **Acceptance Criteria:** Accurate quota tracking across all tool calls in a session
- **Priority:** Must Have

---

## 7. Non-Functional Requirements

- **Performance:** Single channel analysis <10s, score-only <3s
- **Scalability:** Handle concurrent requests; stateless design (no session state)
- **Reliability:** Graceful error handling — invalid channels, quota exceeded, API errors all return actionable messages
- **Security:** API key never logged or returned in responses; support env var injection
- **Compatibility:** Must work as stdio transport (local) and streamable HTTP (remote/hosted)

---

## 8. Technical Considerations

### Architecture

- **Language:** TypeScript (recommended by MCP ecosystem, good SDK support)
- **Framework:** `@modelcontextprotocol/sdk` TypeScript SDK
- **Transport:** stdio for local use (Claude Desktop, Claude Code), streamable HTTP for remote hosting
- **Core Engine:** Import and reuse the existing analysis modules from the Apify actor (`analytics.js`, `sponsorship.js`, `authenticity.js`, `rate-card.js`, `youtube-api.js`)
- **Package Manager:** npm

### Project Structure

```
creator-fusion-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── analyze-channel.ts
│   │   ├── compare-channels.ts
│   │   ├── get-rate-card.ts
│   │   ├── detect-sponsorships.ts
│   │   ├── check-authenticity.ts
│   │   └── get-creator-score.ts
│   ├── engine/               # Ported from Apify actor (JS → TS)
│   │   ├── youtube-api.ts
│   │   ├── analytics.ts
│   │   ├── sponsorship.ts
│   │   ├── authenticity.ts
│   │   └── rate-card.ts
│   └── utils/
│       ├── api-key.ts        # Key management (env var + param)
│       └── errors.ts         # Actionable error messages
├── README.md
└── LICENSE
```

### Key Design Decisions

1. **Reuse existing engine** — Port the 5 analysis modules from JS to TS rather than rewriting. The algorithms are tested and production-proven.
2. **Stateless** — No session state between tool calls. Each call gets its own YouTubeClient instance. This simplifies hosting and scaling.
3. **Composable tools** — Individual tools (score, rate card, sponsorship) instead of one monolithic "analyze everything" tool. AI agents can pick the right tool for the question.
4. **Env var first** — API key defaults to `YOUTUBE_API_KEY` env var so users configure once, not per-call.

### Third-Party Dependencies

- `@modelcontextprotocol/sdk` — Official MCP TypeScript SDK
- `zod` — Input validation schemas
- `got-scraping` or `node-fetch` — HTTP client for YouTube API

---

## 9. Competitive Analysis

| Competitor | What They Do | Our Differentiation |
|------------|-------------|---------------------|
| YouTube Data API (raw) | Raw data only — no scoring, no analysis | We add Creator Fusion Score™, sponsorship detection, authenticity, rate cards |
| Apify YouTube scrapers | Batch scraping, return raw data | We do analysis, not just extraction; MCP gives real-time access |
| SocialBlade API | Basic stats, no sponsorship/authenticity | We go deeper — sponsorship history, engagement validation, pricing |
| No existing creator analytics MCP servers | N/A | First mover in MCP ecosystem for creator analytics |

---

## 10. Scope & Prioritization

**MVP (Phase 1) — Ship This:**
- `analyze_channel` — full pipeline, single channel
- `compare_channels` — multi-channel comparison
- `get_creator_score` — quick score lookup
- `get_rate_card` — rate card only
- API key via env var + tool param
- Quota tracking in every response
- stdio transport (works with Claude Desktop, Claude Code)
- README with setup instructions
- Published to npm

**Phase 2:**
- `detect_sponsorships` — standalone sponsorship tool
- `check_authenticity` — standalone authenticity tool
- Streamable HTTP transport (remote hosting)
- Publish to MCP registries (Anthropic, Apify MCP Configurator)
- Rate limiting and caching layer

**Phase 3 / Future:**
- Channel discovery tool ("find creators in gaming niche with 50K+ subs")
- Multi-platform support (TikTok, Instagram modules)
- Historical tracking (scheduled analysis, trend detection)
- Paid tier with higher rate limits
- Hosted version on Vercel or similar

**Out of Scope (for now):**
- Web UI or dashboard
- User accounts / authentication beyond API key
- Database storage of historical results
- TikTok/Instagram analysis

---

## 11. Timeline & Milestones

| Phase | Milestone | Target | Deliverables |
|-------|-----------|--------|--------------|
| Setup | Project scaffolding + TS config | Day 1 | Repo, package.json, tsconfig |
| Engine Port | Port 5 analysis modules JS → TS | Days 2–3 | Typed engine modules |
| Tools | Implement 4 MVP tools | Days 4–5 | analyze, compare, score, rate card |
| Integration | Wire tools to MCP server, test | Day 6 | Working stdio server |
| Docs | README, npm publish | Day 7 | Published package |
| Phase 2 | HTTP transport + registries | Week 3 | Remote hosting, listed on registries |

---

## 12. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| YouTube API quota limits restrict usage | Medium | High | Quota tracking in every response; warn users at 80% usage; support multiple API keys |
| MCP spec changes break server | Low | Medium | Pin SDK version; monitor spec updates |
| TypeScript port introduces bugs | Medium | Medium | Port module-by-module with tests; compare output against known Apify results |
| Low initial adoption | Medium | Low | Publish to multiple registries; create demo videos; cross-promote from Apify listing |
| YouTube API response shape changes | Low | High | Defensive parsing (already implemented); version pin API calls |

---

## 13. Dependencies & Assumptions

**Dependencies:**
- YouTube Data API v3 (free tier)
- MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- User provides their own YouTube API key

**Assumptions:**
- MCP ecosystem continues to grow (strong signal from Anthropic, Apify, and others)
- YouTube Data API v3 remains free at current quota levels
- The existing analysis algorithms (CF Score, sponsorship detection, etc.) are production-ready (validated by Apify test runs)
- stdio transport is sufficient for MVP (Claude Desktop + Claude Code cover primary use cases)

---

## 14. Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should the MCP server live in the same repo or a new one? | Jon | Open — recommend new repo `creator-fusion-mcp-server` |
| Pricing model for hosted/paid tier? | Jon | Open — deferred to Phase 3 |
| Should we publish to npm as a scoped package (@creator-fusion/mcp-server)? | Jon | Open — recommend yes for branding |
| Do we need a separate Google Cloud project for MCP server API key? | Jon | Open — recommend using same key, separate tracking |
| TypeScript strict mode or relaxed for faster porting? | Jon | Open — recommend strict for quality |
