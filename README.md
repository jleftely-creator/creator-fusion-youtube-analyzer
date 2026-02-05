# 🎬 Creator Fusion — YouTube Creator Analyzer

> **The only Apify actor that answers the question brands actually pay to answer: "Should I give this creator money, and how much?"**

Analyze YouTube creators for brand partnerships with metrics no other scraper provides: a composite **Creator Score (0–100)**, **sponsorship history detection**, **engagement authenticity signals**, and **sponsorship rate card generation** — all from a single run using the free YouTube Data API. Zero proxy cost. Zero browser cost.

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Apify Actor](https://img.shields.io/badge/Apify-Actor-blue.svg)](https://apify.com)

---

## What Makes This Different

The Apify Store has dozens of YouTube scrapers that pull subscriber counts and view numbers. This actor goes further — it produces **brand-partnership-ready intelligence**.

| Feature | Other YouTube Scrapers | This Actor |
|---|---|---|
| Channel stats (subs, views) | ✅ | ✅ |
| Video-level engagement metrics | Some | ✅ Detailed per-video breakdown |
| **Composite Creator Score (0–100)** | ❌ | ✅ Tier-adjusted, weighted, graded A+ to F |
| **Sponsorship history detection** | ❌ | ✅ Brands, promo codes, affiliate networks |
| **Engagement authenticity analysis** | ❌ | ✅ 5-signal statistical anomaly detection |
| **Sponsorship rate cards** | ❌ | ✅ 4 deal types × niche & engagement multipliers |
| **Partnership readiness assessment** | ❌ | ✅ Strengths, red flags, brand recommendation |
| Proxy cost | $5–15/run | **$0** |
| Browser required | Usually | **No** |
| Channels per day (free tier) | ~50–200 | **~2,500** |

---

## How It Works

1. **You provide** a list of YouTube channels (URLs, `@handles`, or channel IDs) and your free YouTube Data API key.
2. **The API client** fetches channel details and recent videos using the official YouTube Data API v3 — with automatic retry logic, quota tracking, and structured error handling.
3. **The analytics engine** computes engagement metrics, posting consistency, audience quality, view distribution analysis, and a weighted Creator Score.
4. **Sponsorship detection** scans every video description for FTC disclosure hashtags, sponsorship phrases, 25+ affiliate network URLs, 25+ known sponsor brands, and promo codes.
5. **Authenticity analysis** runs 5 independent statistical checks on engagement patterns to flag potentially bought followers, fake likes, or bot activity.
6. **Rate card generation** produces estimated sponsorship pricing across 4 deal types, adjusted by audience tier, content niche, engagement quality, and brand deal experience.
7. **Results are pushed** to the Apify dataset — exportable as JSON, CSV, or Excel.

---

## Features In Depth

### 📊 Core Analytics Engine

Every channel gets a full engagement and consistency breakdown computed from recent video data:

- **Engagement Rate** — `(likes + comments) / views × 100`, the #1 metric brands care about
- **Average Views, Likes, Comments** — per-video averages across the analysis window
- **Like-to-View Ratio** and **Comment-to-View Ratio** — separate engagement signal quality
- **View-to-Subscriber Ratio** — what percentage of subscribers actually watch each video
- **Posts Per Week** — upload frequency calculated from video publish dates
- **Posting Consistency Score (0–100)** — measures regularity of upload schedule using standard deviation of upload gaps; higher = more predictable
- **View Distribution Analysis** — median, mean, min, max, and skew ratio to detect viral outlier dependency
- **Top & Worst Performing Videos** — identifies best and worst content by views with full engagement stats
- **Date Range Coverage** — shows the time span of analyzed content

### 🏆 Creator Score (0–100)

A composite score that ranks creators for brand partnership potential. The score is **tier-adjusted** — a 5% engagement rate means something very different for a 10K channel vs. a 1M channel.

**Weighted formula:**

| Signal | Weight | What It Measures | Scoring Detail |
|---|---|---|---|
| **Engagement Rate** | 35% | Likes + comments relative to views | Benchmarked against tier averages: Nano 8–12%, Micro 5–8%, Mid-Tier 3–5%, Macro 2–3.5%, Mega 1.5–2.5% |
| **Posting Consistency** | 20% | Standard deviation of upload gaps | 100 = perfectly regular schedule, 0 = completely erratic |
| **Posting Frequency** | 15% | Videos per week | Sweet spot: 2–5/week. Slight penalty for overposting (>5/week), steep drop for <1/week |
| **View-to-Subscriber Ratio** | 15% | % of subscribers watching each video | 20–40% is healthy; <10% suggests inactive audience |
| **Audience Reach** | 15% | Raw subscriber count | Tiered scoring: 1M+ = 95, 500K+ = 85, 100K+ = 75, etc. |

**Letter grades:** A+ (90+), A (80+), B+ (70+), B (60+), C+ (50+), C (40+), D (30+), F (<30)

**Audience tiers:** Nano (1K–10K), Micro (10K–50K), Mid-Tier (50K–500K), Macro (500K–1M), Mega (1M+)

Each score includes a full breakdown showing the individual signal scores, weights, and contextual detail (e.g., `"3.42% engagement — benchmark: 1.5–2.5% for Mega"`).

### 🔍 Sponsorship Detection Engine

Scans every video description for sponsorship indicators at **zero additional API cost** — all analysis uses description text already fetched.

**What it detects:**

- **FTC Disclosure Hashtags** — `#ad`, `#sponsored`, `#partner`, `#paidpartnership`, `#collab`, `#gifted`, `#brandambassador`, `#affiliate`
- **Sponsorship Phrases** — 15+ patterns including "sponsored by", "brought to you by", "this video is sponsored", "paid promotion", "use my code/link", "sign up using my link", "check them out at"
- **Affiliate Network URLs** — 25+ networks detected:
  - Amazon Associates, ShareASale, Impact Radius, CJ Affiliate, Rakuten, Awin, PartnerStack, LTK/RewardStyle, Geni.us
  - Brand-specific: Skillshare, Squarespace, NordVPN, ExpressVPN, Surfshark, Audible, Honey/PayPal, HelloFresh, Ridge Wallet, Manscaped, BetterHelp, Athletic Greens/AG1, Casetify, Raid Shadow Legends, Established Titles
  - Tracking: Bitly, Linktree, UTM parameters
- **Promo Codes** — Extracts actual codes using pattern matching (e.g., "use code MKBHD"), with a built-in filter for 25+ generic English words that match the pattern but aren't codes
- **Brand Name Extraction** — Pulls brand names from "sponsored by [BRAND]" patterns

**Output includes:**
- Total sponsored videos found and sponsorship rate (% of analyzed videos)
- Sponsorship rate label (None / Low / Moderate / High / Very High)
- FTC disclosure compliance rate
- Detected brands sorted by mention frequency
- All extracted promo codes
- List of affiliate networks found
- Per-video sponsorship signal breakdown

### 🛡️ Engagement Authenticity Analysis

Five independent statistical signals detect potentially fake engagement — all computed from data already fetched, zero extra API cost.

| Signal | What It Detects | How It Works | Severity |
|---|---|---|---|
| **Like Consistency** | Like bots applying likes at a fixed rate | Measures coefficient of variation (CV) of like-to-view ratios across videos. Natural channels show CV of 0.15–0.8; bot-boosted channels show CV < 0.15 | High (−30 pts) |
| **Comment-to-Like Ratio** | Like bots purchased without comment bots | Normal range: 0.5–20 comments per 100 likes. Very low suggests inflated likes; very high suggests comment spam or pods | High (−25 pts) or Medium (−15 pts) |
| **Lifetime Views per Subscriber** | Bought subscribers who never watch | Channels with <5 lifetime views per subscriber (and >1K subs) likely have purchased followers | High (−25 pts) |
| **Zero-Comment High-Engagement** | Like bots on videos with disabled/no comments | Videos with 50+ likes but 0 comments (comments not disabled) — real viewers who like occasionally comment | Medium (−15 pts) |
| **View Distribution Flatness** | Bought views creating artificial consistency | Measures CV of view counts across videos. CV < 0.1 with 5+ videos is unnaturally flat | Medium (−15 pts) |

**Scoring:** Starts at 100, deducts points per flag. Labels: High Authenticity (85+), Moderate (65+), Low (40+), Very Low (<40).

Each flag includes severity level, signal name, and a detailed explanation with the actual numbers. Requires at least 3 videos with 100+ views to produce a score.

### 💰 Sponsorship Rate Card Generator

Produces estimated pricing across **4 deal types**, adjusted by 3 multiplier layers.

**Deal types:**

| Type | Description | CPM Multiplier |
|---|---|---|
| **Integration** | 30–60 second mention within a video | 1.0× base CPM |
| **Dedicated Video** | Full video about the product/service | 2.0× base CPM |
| **Shorts** | YouTube Shorts mention (estimated 60% of regular views) | 0.3× base CPM |
| **Usage Rights** | Licensing creator content for brand ads (social, display, TV) | 30–100% addon on integration rate |

**CPM benchmarks by tier (USD per 1,000 views):**

| Tier | Low CPM | Mid CPM | High CPM |
|---|---|---|---|
| Nano | $5 | $10 | $20 |
| Micro | $10 | $18 | $30 |
| Mid-Tier | $15 | $22 | $35 |
| Macro | $20 | $28 | $40 |
| Mega | $25 | $35 | $50 |

**Floor pricing** ensures small channels don't get absurdly low estimates (e.g., Micro integration floor: $500).

**Adjustment multipliers:**

1. **Niche Multiplier** — Finance (1.5×), Business (1.4×), Technology (1.3×), Science/Health (1.2×), Lifestyle/Education (1.1×), Gaming/Entertainment/Film (0.9×), Comedy (0.85×), Music (0.8×). Detected from YouTube's topic categories.
2. **Engagement Multiplier** — Based on Creator Score: 80+ (1.25×), 65+ (1.10×), 50+ (1.0×), 35+ (0.85×), <35 (0.7×).
3. **Brand Deal Experience** — Assessed from sponsorship detection results: Very Experienced (10+ deals), Experienced (5+), Some Experience (1+), or No History.

### 🤝 Partnership Readiness Assessment

Automatically identifies strengths and red flags for brand partnerships:

**Strengths detected:**
- Exceptional engagement rate for tier
- Very consistent posting schedule
- Strong posting cadence
- High subscriber-to-view conversion
- Consistent video performance (low variance)

**Red flags detected:**
- Below-average engagement for tier
- Infrequent posting (<1 per 2 weeks)
- Irregular posting schedule
- High view variance (possible viral outliers skewing averages)
- Low view-to-sub ratio (possible inactive audience)

Includes a `recommendedForBrands` boolean — `true` if Creator Score ≥ 50 and ≤ 1 red flag.

---

## Output Example

```json
{
    "status": "success",
    "channelId": "UCBcRF18a7Qf58cCRy5xuWwQ",
    "channelName": "MKBHD",
    "channelUrl": "https://youtube.com/channel/UCBcRF18a7Qf58cCRy5xuWwQ",
    "handle": "@mkbhd",
    "subscriberCount": 19400000,
    "totalViews": 4800000000,
    "totalVideos": 1850,

    "creatorScore": {
        "score": 87,
        "grade": "A",
        "tier": "Mega",
        "tierLabel": "mega (1M+)",
        "breakdown": {
            "engagement": { "score": 92, "weight": "35%", "detail": "3.42% (benchmark: 1.5–2.5% for Mega)" },
            "consistency": { "score": 82, "weight": "20%", "detail": "82/100 consistency" },
            "frequency": { "score": 78, "weight": "15%", "detail": "2.1 posts/week" },
            "viewToSubRatio": { "score": 88, "weight": "15%", "detail": "21.6% of subs watch each video" },
            "audienceSize": { "score": 95, "weight": "15%", "detail": "19.4M subscribers (Mega)" }
        }
    },

    "analytics": {
        "videoCount": 30,
        "engagementRate": 3.42,
        "avgViews": 4200000,
        "avgLikes": 130000,
        "avgComments": 12000,
        "viewToSubRatio": 21.6,
        "postsPerWeek": 2.1,
        "postingConsistency": 82,
        "viewDistribution": { "median": 3800000, "mean": 4200000, "skewRatio": 1.11 },
        "topPerformingVideo": { "title": "...", "views": 12000000, "engagementRate": 4.1 },
        "worstPerformingVideo": { "title": "...", "views": 1200000, "engagementRate": 2.8 }
    },

    "sponsorship": {
        "totalVideosScanned": 30,
        "totalDetected": 8,
        "sponsorshipRate": 27,
        "sponsorshipRateLabel": "Moderate — regular but balanced",
        "disclosureRate": 100,
        "detectedBrands": [
            { "brand": "Dbrand", "mentionCount": 4 },
            { "brand": "NordVPN", "mentionCount": 2 }
        ],
        "promoCodes": ["MKBHD"],
        "affiliateNetworks": ["Amazon Associates", "Impact Radius"]
    },

    "authenticity": {
        "score": 95,
        "label": "High authenticity — no significant red flags",
        "flags": [],
        "videosAnalyzed": 28,
        "signals": {
            "likeConsistency": { "coefficientOfVariation": 0.42, "naturalRange": "0.15–0.8" },
            "commentToLikeRatio": { "value": 9.2, "normalRange": "0.5–20" },
            "lifetimeViewsPerSubscriber": { "value": 247.4, "minimum": 5 }
        }
    },

    "rateCard": {
        "estimatedIntegrationRate": { "low": 85000, "mid": 120000, "high": 180000 },
        "estimatedDedicatedRate": { "low": 170000, "mid": 240000, "high": 360000 },
        "estimatedShortsRate": { "low": 15000, "mid": 22000, "high": 35000 },
        "usageRightsAddon": { "low": 36000, "mid": 78000, "high": 120000 },
        "adjustments": {
            "niche": { "category": "Technology", "multiplier": 1.3 },
            "engagement": { "creatorScore": 87, "multiplier": 1.25 },
            "combined": 1.63
        },
        "brandDealExperience": "Experienced — regular brand deals"
    },

    "partnership": {
        "estimatedSponsoredPostValue": { "low": 84000, "high": 210000, "currency": "USD" },
        "strengths": [
            "Exceptional engagement rate for tier",
            "Very consistent posting schedule",
            "High subscriber-to-view conversion"
        ],
        "flags": [],
        "contentCategories": ["Technology", "Entertainment"],
        "recommendedForBrands": true
    },

    "analyzedAt": "2025-12-15T14:30:00.000Z"
}
```

---

## Input Options

| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `apiKey` | string | — | ✅ | YouTube Data API v3 key ([get one free](https://console.cloud.google.com/apis/library/youtube.googleapis.com)) |
| `channels` | string[] | — | ✅ | Channel URLs, `@handles`, or channel IDs |
| `videosPerChannel` | integer | `30` | — | Recent videos to analyze per channel (5–200). More = more accurate but uses more quota |
| `enableSponsorshipDetection` | boolean | `true` | — | Scan descriptions for sponsorship indicators. No extra API cost |
| `enableAuthenticityCheck` | boolean | `true` | — | Run engagement authenticity analysis. No extra API cost |
| `enableRateCard` | boolean | `true` | — | Generate sponsorship rate cards |
| `minSubscribers` | integer | `0` | — | Skip channels below this subscriber count |
| `minEngagementRate` | number | `0` | — | Skip channels below this engagement rate (%) |

### Accepted Channel Formats

All of these work:
- `https://www.youtube.com/@MrBeast`
- `https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA`
- `https://youtube.com/c/MrBeast`
- `@MrBeast`
- `MrBeast`
- `UCX6OQ3DkcsbYNE6H8uQQuVA`

---

## API Quota & Cost

**Near zero.** This actor uses YouTube Data API v3 (HTTP requests only) — no browser instances, no residential proxies.

| Resource | Cost |
|---|---|
| YouTube API quota per channel | ~3–5 units |
| Free daily quota | 10,000 units |
| **Channels per day (free tier)** | **~2,500** |
| Compute (RAM) | ~128 MB |
| Time per 100 channels | < 2 minutes |
| Proxy cost | **$0** |

### Getting Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for **YouTube Data API v3** → **Enable**
5. Go to **Credentials → Create Credentials → API Key**
6. Copy the key and paste it into the actor input

---

## Use Cases

**Brands & Agencies** — Evaluate creator rosters for campaigns. Compare Creator Scores, check sponsorship history, validate engagement authenticity, and generate rate cards before negotiating.

**Influencer Marketing Platforms** — Bulk-analyze creators for marketplace listings. The structured JSON output integrates directly into databases and dashboards.

**Talent Managers** — Benchmark your roster against tier averages. Identify which creators are underpriced (high score, low current rates) and which have authenticity concerns.

**Creators** — Understand your own metrics vs. industry benchmarks. See what brands see when they evaluate you. Use the rate card to set informed pricing.

**Competitive Research** — Analyze competitor creator partnerships via sponsorship detection. See which brands are sponsoring which creators and at what frequency.

---

## Bulk Analysis Examples

### Analyze a Creator Roster

```json
{
    "apiKey": "YOUR_API_KEY",
    "channels": ["@mkbhd", "@MrBeast", "@LinusTechTips", "@PewDiePie"],
    "videosPerChannel": 50,
    "enableSponsorshipDetection": true,
    "enableAuthenticityCheck": true,
    "enableRateCard": true
}
```

### Filter for High-Quality Mid-Tier Creators

```json
{
    "apiKey": "YOUR_API_KEY",
    "channels": ["@creator1", "@creator2", "@creator3"],
    "minSubscribers": 50000,
    "minEngagementRate": 3.0
}
```

### Quick Score Check (Minimal Quota)

```json
{
    "apiKey": "YOUR_API_KEY",
    "channels": ["@MrBeast"],
    "videosPerChannel": 10,
    "enableSponsorshipDetection": false,
    "enableAuthenticityCheck": false,
    "enableRateCard": false
}
```

---

## Architecture

```
src/
├── main.js            — Orchestrator: input validation, channel pipeline, dataset output
├── youtube-api.js     — YouTube Data API v3 client with retry logic and quota tracking
├── analytics.js       — Engagement metrics, Creator Score, partnership insights
├── sponsorship.js     — FTC disclosure, affiliate link, and promo code detection
├── authenticity.js    — 5-signal statistical engagement fraud detection
└── rate-card.js       — CPM-based rate card generator with niche/engagement multipliers
```

Each module is independent — sponsorship, authenticity, and rate card generation can be toggled on/off without affecting core analytics.

---

## Error Handling

- Individual channel failures don't stop the batch — failed channels are logged and pushed to the dataset with an `error` field and `status: "failed"`
- API quota exhaustion is detected and reported with a clear message
- Invalid API keys, disabled APIs, and permission errors return specific guidance
- Transient failures (429, 500, 503) are automatically retried with backoff
- Channels with hidden subscriber counts or no public videos are handled gracefully

---

## License

**Proprietary.** See [LICENSE](LICENSE) for full terms. © 2025 Creator Fusion LLC.

---

## Built by Creator Fusion

This actor is part of the [Creator Fusion](https://creatorfusion.net) platform — business management tools for content creators.

For questions or licensing inquiries: **contact@creatorfusion.net**
