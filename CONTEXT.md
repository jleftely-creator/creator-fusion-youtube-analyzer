# Creator Fusion YouTube Analyzer — Project Context

**Last Updated:** 2026-02-05
**Author:** Jon (jleftely-creator)
**Status:** Live on Apify + GitHub

---

## Project Overview

The Creator Fusion YouTube Analyzer is a production Apify actor that analyzes YouTube creators for brand partnership potential. It computes a proprietary **Creator Fusion Score™ (0–100)**, detects sponsorship history, validates engagement authenticity, and generates rate cards — all from the free YouTube Data API v3. Zero proxy cost, zero browser cost.

**This is both a monetized Apify marketplace product AND the data pipeline for the Creator Fusion platform.**

---

## Current State

### Live Deployments

- **Apify Actor:** `apricot_blackberry/youtube-creator-analyzer` (ID: `zFZynr5oafRKqTHLG`)
  - Console: https://console.apify.com/actors/zFZynr5oafRKqTHLG
  - Build: 1.0.1 (latest) — successfully deployed 2026-02-05
- **GitHub Repo:** https://github.com/jleftely-creator/creator-fusion-youtube-analyzer (public)
  - Latest commit: `84617c8` — "Add test-input.json to gitignore to protect API keys"
- **GitHub Secret:** `YOUTUBE_API_KEY` stored on the repo

### Test Run Results (2026-02-05)

| Creator | CF Score | Grade | Tier | Engagement |
|---------|----------|-------|------|------------|
| MrBeast | 65 | B | Mega | 1.35% |
| Marques Brownlee | 74 | B+ | Mega | 3.38% |

- Quota used: 8 units (out of 10,000 daily free)
- Runtime: <2 seconds for 2 channels

---

## Architecture

### Tech Stack

- **Runtime:** Node.js 20 (ES Modules)
- **Platform:** Apify (actor-node:20 Docker image, ~128MB RAM)
- **API:** YouTube Data API v3 (free tier, 10,000 units/day ≈ 2,500 channels/day)
- **Dependencies:** `apify@^3.1.0`, `got-scraping@^4.0.0`
- **License:** Proprietary (Creator Fusion LLC)

### Module Architecture

```
creator-fusion-youtube-analyzer/
├── actor.json              # Apify marketplace metadata + dataset views
├── Dockerfile              # Lightweight — no browser
├── input_schema.json       # Apify input UI definition
├── package.json            # ESM, Node 20+
├── README.md               # SEO-optimized marketplace listing
├── LICENSE                 # Proprietary — Creator Fusion LLC
├── IP-PROTECTION-NOTES.md  # IP protection strategy doc
├── .gitignore              # Protects test-input.json, node_modules, etc.
└── src/
    ├── main.js             # Orchestrator — pipeline per channel, error isolation
    ├── youtube-api.js      # YouTube Data API v3 client with quota tracking + retry
    ├── analytics.js        # Engagement metrics, Creator Fusion Score™, partnership insights
    ├── sponsorship.js      # Description scanning: #ad, affiliate links, promo codes, brands
    ├── authenticity.js     # Statistical engagement validation (5 signals, 0–100 score)
    └── rate-card.js        # CPM-based pricing: integration, dedicated, Shorts, usage rights
```

### Data Flow

1. **Input:** API key + channel list (URLs, @handles, or IDs)
2. **Resolution:** `youtube-api.js` resolves handles → channel IDs (1–2 quota units)
3. **Fetch:** Channel details + recent videos (2–3 quota units per channel)
4. **Parse:** `analytics.js` → `parseVideos()` extracts structured video data
5. **Analyze:** `analytics.js` → `analyzeVideos()` computes engagement metrics
6. **Score:** `analytics.js` → `calculateCreatorFusionScore()` produces 0–100 weighted score with grade (A+ to F) and tier (Nano/Micro/Mid-Tier/Macro/Mega)
7. **Sponsorship:** `sponsorship.js` → `detectSponsorships()` scans descriptions for deals
8. **Authenticity:** `authenticity.js` → `analyzeAuthenticity()` flags fake engagement
9. **Rate Card:** `rate-card.js` → `generateRateCard()` produces pricing estimates
10. **Output:** Push to Apify dataset (JSON, CSV, Excel, XML export)

### Key Algorithms

**Creator Fusion Score™ (0–100)** — Weighted composite:
- Engagement rate (35%)
- Posting frequency (20%)
- Posting consistency (15%)
- Audience size (15%)
- View distribution health (15%)
- Overposting penalty applied for >5 posts/week
- Minimum 3-video threshold for consistency scoring

**Sponsorship Detection** — Zero extra API calls:
- 8 FTC disclosure hashtags
- 15 sponsorship phrases
- 26 affiliate network URL patterns
- Promo code extraction
- Brand name extraction from "sponsored by X" patterns

**Engagement Authenticity (0–100):**
- Like-to-view ratio consistency (coefficient of variation)
- Comment-to-like ratio anomalies
- Lifetime views-per-subscriber check
- Zero-comment/high-likes detection
- View count distribution flatness

**Rate Card Generator:**
- CPM tables by tier (Nano through Mega)
- Deal types: integration, dedicated, Shorts, usage rights
- Niche multipliers (Finance 1.5x, Gaming 0.9x, etc.)
- Creator Fusion Score multiplier (80+ gets 1.25x)
- Floor pricing by tier (Nano minimum $100+)

### Output Schema (per channel)

```json
{
  "status": "success",
  "channelId": "UC...",
  "channelName": "...",
  "channelUrl": "https://youtube.com/channel/...",
  "handle": "@...",
  "description": "...",
  "country": "US",
  "subscriberCount": 100000,
  "hiddenSubscriberCount": false,
  "totalViews": 50000000,
  "totalVideos": 500,
  "joinedDate": "2015-03-10",
  "thumbnailUrl": "...",
  "creatorFusionScore": {
    "score": 74,
    "grade": "B+",
    "tier": "Mega",
    "breakdown": { "engagement": 28, "frequency": 16, "consistency": 12, "audience": 10, "distribution": 8 }
  },
  "analytics": {
    "engagementRate": 3.38,
    "avgViews": 5000000,
    "avgLikes": 150000,
    "avgComments": 12000,
    "postsPerWeek": 1.5,
    "postingConsistency": 80,
    "viewDistribution": { "median": 4200000, "p25": 2100000, "p75": 7500000 }
  },
  "partnership": {
    "strengths": [...],
    "flags": [...],
    "contentCategories": [...],
    "recommendedForBrands": true,
    "estimatedSponsoredPostValue": { "low": 25000, "high": 75000 }
  },
  "sponsorship": {
    "totalDetected": 8,
    "sponsorshipRate": 0.27,
    "disclosureCompliance": 0.75,
    "detectedBrands": ["NordVPN", "Squarespace"],
    "promoCodes": ["MKBHD20"]
  },
  "authenticity": {
    "score": 92,
    "label": "High authenticity — no significant red flags",
    "flags": [],
    "signals": { ... }
  },
  "rateCard": {
    "estimatedIntegrationRate": { "low": 20000, "mid": 35000, "high": 55000 },
    "estimatedDedicatedRate": { "low": 40000, "mid": 70000, "high": 110000 },
    "estimatedShortsRate": { "low": 6000, "mid": 10500, "high": 16500 },
    "usageRightsAddon": { "low": 10000, "mid": 17500, "high": 27500 }
  },
  "analyzedAt": "2026-02-05T...",
  "quotaSnapshot": { "quotaUsed": 4, "estimatedRemaining": 9996 }
}
```

### Input Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | string | (required) | YouTube Data API v3 key |
| `channels` | string[] | (required) | Channel URLs, @handles, or IDs |
| `videosPerChannel` | integer | 30 | Recent videos to analyze (5–200) |
| `enableSponsorshipDetection` | boolean | true | Scan for sponsorship indicators |
| `enableAuthenticityCheck` | boolean | true | Run engagement authenticity analysis |
| `enableRateCard` | boolean | true | Generate sponsorship rate cards |
| `minSubscribers` | integer | 0 | Skip channels below threshold |
| `minEngagementRate` | number | 0 | Skip channels below engagement % |

---

## Business Context

- **Company:** Creator Fusion LLC (https://creatorfusion.com)
- **Mission:** Business management platform for content creators
- **Revenue:** First paid software revenue via Apify marketplace actors
- **YouTube API Key:** Stored as GitHub secret `YOUTUBE_API_KEY`, restricted to YouTube Data API v3 only in Google Cloud Console
- **Pricing:** Currently pay-per-result on Apify marketplace (strategy needs refinement)

---

## What's Next: MCP Server

The next feature is wrapping this analyzer as an **MCP (Model Context Protocol) server** so that AI agents (Claude, ChatGPT, etc.) can call Creator Fusion's analysis tools directly. This turns the analyzer from a batch job into a real-time AI-callable service.

See `CREATOR-FUSION-MCP-SERVER-PRD.md` for full requirements.
