/**
 * Rate Card Generator
 *
 * Produces structured sponsorship rate cards based on channel metrics,
 * audience tier, engagement quality, and industry CPM benchmarks.
 *
 * Rate types generated:
 *   - Integration (30–60s mention within a video)
 *   - Dedicated video (full video about the product)
 *   - Shorts mention (YouTube Shorts)
 *   - Usage rights (licensing content for brand ads)
 *
 * All estimates are ranges — actual rates vary by niche, negotiation,
 * exclusivity terms, and usage rights.
 *
 * © 2025 Creator Fusion LLC
 */

// ─── CPM tables by tier (USD per 1,000 views) ───────────────────────────────

/**
 * Base CPM ranges for a mid-video integration (30–60s).
 * Dedicated videos are ~2x; Shorts are ~0.3x.
 */
const BASE_CPM = {
    'Nano':     { low: 5,   mid: 10,  high: 20 },
    'Micro':    { low: 10,  mid: 18,  high: 30 },
    'Mid-Tier': { low: 15,  mid: 22,  high: 35 },
    'Macro':    { low: 20,  mid: 28,  high: 40 },
    'Mega':     { low: 25,  mid: 35,  high: 50 },
};

/**
 * Fixed-fee minimums by tier (floor pricing regardless of views).
 * Prevents low-view channels from generating $5 rate cards.
 */
const TIER_FLOORS = {
    'Nano':     { integration: 100,    dedicated: 200,    shorts: 50 },
    'Micro':    { integration: 500,    dedicated: 1_000,  shorts: 150 },
    'Mid-Tier': { integration: 2_500,  dedicated: 5_000,  shorts: 500 },
    'Macro':    { integration: 10_000, dedicated: 25_000, shorts: 2_000 },
    'Mega':     { integration: 30_000, dedicated: 75_000, shorts: 5_000 },
};

/** Niche multipliers — some verticals command higher CPMs */
const NICHE_MULTIPLIERS = {
    'Technology':   1.3,
    'Finance':      1.5,
    'Business':     1.4,
    'Science':      1.2,
    'Education':    1.1,
    'Health':       1.2,
    'Gaming':       0.9,
    'Music':        0.8,
    'Entertainment': 0.9,
    'Sports':       1.0,
    'Lifestyle':    1.1,
    'Comedy':       0.85,
    'Film':         0.9,
    'Society':      1.0,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a rate card for a creator.
 *
 * @param {object} params
 * @param {number} params.avgViews          — average views per video
 * @param {number} params.subscribers       — subscriber count
 * @param {string} params.tier              — audience tier name
 * @param {number} params.engagementRate    — engagement rate (%)
 * @param {number} params.creatorFusionScore — Creator Fusion Score™ (0–100)
 * @param {string[]} params.contentCategories — channel topic categories
 * @param {object} params.sponsorship       — sponsorship detection results
 * @returns {RateCard}
 */
export function generateRateCard({
    avgViews,
    subscribers,
    tier,
    engagementRate,
    creatorFusionScore,
    contentCategories = [],
    sponsorship = null,
}) {
    const baseCpm = BASE_CPM[tier] ?? BASE_CPM['Mid-Tier'];
    const floors  = TIER_FLOORS[tier] ?? TIER_FLOORS['Mid-Tier'];

    // ── Niche adjustment ─────────────────────────────────────────────────────
    let nicheMultiplier = 1.0;
    let matchedNiche    = 'General';

    for (const cat of contentCategories) {
        for (const [niche, mult] of Object.entries(NICHE_MULTIPLIERS)) {
            if (cat.toLowerCase().includes(niche.toLowerCase())) {
                if (mult > nicheMultiplier) {
                    nicheMultiplier = mult;
                    matchedNiche = niche;
                }
            }
        }
    }

    // ── Engagement premium/discount ──────────────────────────────────────────
    // Creators with above-average engagement can charge more
    let engagementMultiplier = 1.0;
    if (creatorFusionScore >= 80)      engagementMultiplier = 1.25;
    else if (creatorFusionScore >= 65) engagementMultiplier = 1.10;
    else if (creatorFusionScore >= 50) engagementMultiplier = 1.0;
    else if (creatorFusionScore >= 35) engagementMultiplier = 0.85;
    else                               engagementMultiplier = 0.7;

    const combinedMultiplier = nicheMultiplier * engagementMultiplier;

    // ── Rate calculations ────────────────────────────────────────────────────
    const integration = calcRate(avgViews, baseCpm, 1.0, combinedMultiplier, floors.integration);
    const dedicated   = calcRate(avgViews, baseCpm, 2.0, combinedMultiplier, floors.dedicated);
    const shorts      = calcRate(avgViews * 0.6, baseCpm, 0.3, combinedMultiplier, floors.shorts);

    // Usage/licensing rights: 30–100% on top of the content fee
    const usageRights = {
        low:  Math.round(integration.mid * 0.3),
        mid:  Math.round(integration.mid * 0.65),
        high: Math.round(integration.mid * 1.0),
        note: 'Additional fee for using creator content in brand advertising (social, display, TV).',
    };

    // ── Brand deal experience indicator ──────────────────────────────────────
    let brandDealExperience = 'Unknown';
    if (sponsorship) {
        if (sponsorship.totalDetected >= 10)     brandDealExperience = 'Very experienced — frequent brand partnerships';
        else if (sponsorship.totalDetected >= 5) brandDealExperience = 'Experienced — regular brand deals';
        else if (sponsorship.totalDetected >= 1) brandDealExperience = 'Some experience — occasional partnerships';
        else                                     brandDealExperience = 'No sponsorship history detected — may be open to first deals';
    }

    return {
        currency: 'USD',
        estimatedIntegrationRate: integration,
        estimatedDedicatedRate:   dedicated,
        estimatedShortsRate:      shorts,
        usageRightsAddon:         usageRights,
        adjustments: {
            niche: { category: matchedNiche, multiplier: r2(nicheMultiplier) },
            engagement: { creatorFusionScore, multiplier: r2(engagementMultiplier) },
            combined: r2(combinedMultiplier),
        },
        brandDealExperience,
        disclaimer: 'Estimated rates based on industry benchmarks, audience tier, engagement quality, and niche CPMs. Actual rates depend on negotiation, exclusivity, deliverables, and usage rights.',
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate a rate range for a specific deal type.
 *
 * @param {number} views       — expected views
 * @param {{ low: number, mid: number, high: number }} cpm
 * @param {number} typeMultiplier — deal type multiplier (1x integration, 2x dedicated, etc.)
 * @param {number} qualityMultiplier — combined niche + engagement multiplier
 * @param {number} floor       — minimum rate
 * @returns {{ low: number, mid: number, high: number }}
 */
function calcRate(views, cpm, typeMultiplier, qualityMultiplier, floor) {
    const raw = {
        low:  Math.round((views / 1000) * cpm.low  * typeMultiplier * qualityMultiplier),
        mid:  Math.round((views / 1000) * cpm.mid  * typeMultiplier * qualityMultiplier),
        high: Math.round((views / 1000) * cpm.high * typeMultiplier * qualityMultiplier),
    };

    return {
        low:  Math.max(raw.low, floor),
        mid:  Math.max(raw.mid, Math.round(floor * 1.5)),
        high: Math.max(raw.high, Math.round(floor * 2.5)),
    };
}

function r2(n) { return Math.round(n * 100) / 100; }
