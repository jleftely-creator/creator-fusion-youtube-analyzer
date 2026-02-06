/**
 * Creator Analytics Engine
 *
 * Computes engagement metrics, posting consistency, audience quality signals,
 * and the proprietary Creator Fusion Score™ (0–100) for brand partnership evaluation.
 *
 * © 2025 Creator Fusion LLC
 */

// ─── Tier definitions ────────────────────────────────────────────────────────

const AUDIENCE_TIERS = [
    { name: 'Nano',     min: 0,         max: 9_999,     label: 'nano (1K–10K)' },
    { name: 'Micro',    min: 10_000,    max: 49_999,    label: 'micro (10K–50K)' },
    { name: 'Mid-Tier', min: 50_000,    max: 499_999,   label: 'mid-tier (50K–500K)' },
    { name: 'Macro',    min: 500_000,   max: 999_999,   label: 'macro (500K–1M)' },
    { name: 'Mega',     min: 1_000_000, max: Infinity,  label: 'mega (1M+)' },
];

/**
 * Engagement benchmarks by tier (YouTube industry averages, 2024).
 * "good" = average performer; "great" = top-quartile performer.
 */
const ENGAGEMENT_BENCHMARKS = {
    'Nano':     { good: 8.0,  great: 12.0 },
    'Micro':    { good: 5.0,  great: 8.0 },
    'Mid-Tier': { good: 3.0,  great: 5.0 },
    'Macro':    { good: 2.0,  great: 3.5 },
    'Mega':     { good: 1.5,  great: 2.5 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** @param {number} subscribers */
export function classifyAudienceTier(subscribers) {
    return AUDIENCE_TIERS.find((t) => subscribers >= t.min && subscribers <= t.max)
        ?? AUDIENCE_TIERS[0];
}

/**
 * Parse raw YouTube video objects into a normalized array.
 * Preserves descriptions for downstream sponsorship scanning.
 *
 * @param {Array<Record<string, any>>} videos
 * @returns {Array<ParsedVideo>}
 */
export function parseVideos(videos) {
    return videos
        .map((v) => {
            const stats = v.statistics ?? {};
            const views = safeInt(stats.viewCount);
            const likes = safeInt(stats.likeCount);
            const comments = safeInt(stats.commentCount);
            const publishedAt = new Date(
                v.snippet?.publishedAt ?? v.contentDetails?.videoPublishedAt ?? 0,
            );

            // Guard against invalid dates
            if (Number.isNaN(publishedAt.getTime())) return null;

            const duration = v.contentDetails?.duration ?? 'PT0S';
            const durationSeconds = parseDuration(duration);

            return {
                videoId: v.id,
                title: v.snippet?.title ?? 'Unknown',
                description: v.snippet?.description ?? '',
                tags: v.snippet?.tags ?? [],
                publishedAt,
                views,
                likes,
                comments,
                duration,
                durationSeconds,
                isShort: durationSeconds > 0 && durationSeconds <= 60,
                engagement: views > 0 ? ((likes + comments) / views) * 100 : 0,
                likesDisabled: stats.likeCount === undefined,
                commentsDisabled: stats.commentCount === undefined,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Compute engagement and consistency metrics from parsed videos.
 *
 * @param {Array<ParsedVideo>} parsed  — output of parseVideos()
 * @param {number} subscriberCount
 * @returns {AnalyticsResult}
 */
export function analyzeVideos(parsed, subscriberCount) {
    if (!parsed.length) return emptyAnalytics();

    const totalViews    = sum(parsed, 'views');
    const totalLikes    = sum(parsed, 'likes');
    const totalComments = sum(parsed, 'comments');
    const count         = parsed.length;

    const avgViews    = Math.round(totalViews / count);
    const avgLikes    = Math.round(totalLikes / count);
    const avgComments = Math.round(totalComments / count);

    const engagementRate   = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const likeToViewRatio  = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
    const commentToViewRatio = totalViews > 0 ? (totalComments / totalViews) * 100 : 0;
    const viewToSubRatio   = subscriberCount > 0 ? (avgViews / subscriberCount) * 100 : 0;

    // ── Posting cadence ──────────────────────────────────────────────────────
    const dates     = parsed.map((v) => v.publishedAt).sort((a, b) => a - b);
    const oldest    = dates[0];
    const newest    = dates[dates.length - 1];
    const spanDays  = Math.max(1, (newest - oldest) / 86_400_000);
    const postsPerWeek = (count / spanDays) * 7;

    // ── Posting consistency (0–100, higher = more regular) ───────────────────
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
        gaps.push((dates[i] - dates[i - 1]) / 86_400_000);
    }

    let postingConsistency = 100;
    if (gaps.length >= 2) {
        const avgGap   = sum(gaps) / gaps.length;
        const variance = gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length;
        const stdDev   = Math.sqrt(variance);
        postingConsistency = Math.max(0, Math.round(
            (1 - Math.min(stdDev / Math.max(avgGap, 1), 1)) * 100,
        ));
    } else if (gaps.length === 1) {
        // Only 2 videos — give partial credit (can't measure regularity from 1 gap)
        postingConsistency = 60;
    }

    // ── Top / worst performers ───────────────────────────────────────────────
    const byViews = [...parsed].sort((a, b) => b.views - a.views);
    const medianViews = median(parsed.map((v) => v.views));

    return {
        videoCount: count,
        dateRange: {
            oldest: oldest.toISOString().split('T')[0],
            newest: newest.toISOString().split('T')[0],
            spanDays: Math.round(spanDays),
        },
        engagementRate:       r2(engagementRate),
        avgViews,
        avgLikes,
        avgComments,
        likeToViewRatio:      r2(likeToViewRatio),
        commentToViewRatio:   r2(commentToViewRatio),
        viewToSubRatio:       r2(viewToSubRatio),
        postsPerWeek:         r2(postsPerWeek),
        postingConsistency,
        topPerformingVideo:   videoSummary(byViews[0]),
        worstPerformingVideo: byViews.length > 1 ? videoSummary(byViews[byViews.length - 1]) : null,
        viewDistribution: {
            median: medianViews,
            mean: avgViews,
            max: byViews[0]?.views ?? 0,
            min: byViews[byViews.length - 1]?.views ?? 0,
            skewRatio: medianViews > 0 ? r2(avgViews / medianViews) : 0,
        },
    };
}

// ─── Creator Fusion Score™ ────────────────────────────────────────────────────

/**
 * Creator Fusion Score™ — Proprietary composite score (0–100).
 *
 * The Creator Fusion Score™ and its weighted methodology are proprietary
 * intellectual property of Creator Fusion LLC. See IP-PROTECTION.md.
 *
 * Weights:
 *   Engagement (tier-adjusted)  35%
 *   Posting consistency         20%
 *   Posting frequency           15%
 *   View-to-subscriber ratio    15%
 *   Audience reach              15%
 */
export function calculateCreatorFusionScore(analytics, channelStats) {
    const subscribers = safeInt(channelStats.subscriberCount);
    const tier        = classifyAudienceTier(subscribers);
    const bench       = ENGAGEMENT_BENCHMARKS[tier.name] ?? ENGAGEMENT_BENCHMARKS['Mid-Tier'];

    // 1. Engagement (35%)
    let engScore = 0;
    const er = analytics.engagementRate;
    if (er >= bench.great)      engScore = 90 + Math.min(10, (er - bench.great) * 2);
    else if (er >= bench.good)  engScore = 60 + ((er - bench.good) / (bench.great - bench.good)) * 30;
    else if (er > 0)            engScore = (er / bench.good) * 60;

    // 2. Consistency (20%)
    const conScore = analytics.postingConsistency;

    // 3. Frequency (15%) — sweet spot: 2–5 posts/week
    let freqScore = 0;
    const ppw = analytics.postsPerWeek;
    if      (ppw >= 2 && ppw <= 5) freqScore = 90 + Math.min(10, (ppw - 2) * 3);
    else if (ppw > 5)              freqScore = Math.max(70, 100 - (ppw - 5) * 5); // slight penalty for overposting
    else if (ppw >= 1)             freqScore = 50 + (ppw - 1) * 40;
    else if (ppw >= 0.25)          freqScore = Math.min(50, ppw * 200);
    else if (ppw > 0)              freqScore = 10;

    // 4. View-to-subscriber ratio (15%) — 20–40% is healthy
    let vsScore = 0;
    const vsr = analytics.viewToSubRatio;
    if      (vsr >= 30) vsScore = 90 + Math.min(10, (vsr - 30) * 0.5);
    else if (vsr >= 15) vsScore = 60 + ((vsr - 15) / 15) * 30;
    else if (vsr > 0)   vsScore = (vsr / 15) * 60;

    // 5. Audience reach (15%)
    let audScore = 0;
    if      (subscribers >= 1_000_000) audScore = 95;
    else if (subscribers >= 500_000)   audScore = 85;
    else if (subscribers >= 100_000)   audScore = 75;
    else if (subscribers >= 50_000)    audScore = 65;
    else if (subscribers >= 10_000)    audScore = 50;
    else if (subscribers >= 1_000)     audScore = 30;
    else                               audScore = 10;

    const score = Math.round(
        clamp(engScore, 0, 100) * 0.35
        + clamp(conScore, 0, 100) * 0.20
        + clamp(freqScore, 0, 100) * 0.15
        + clamp(vsScore, 0, 100) * 0.15
        + clamp(audScore, 0, 100) * 0.15,
    );

    const grade = scoreToGrade(score);

    return {
        score: clamp(score, 0, 100),
        grade,
        tier: tier.name,
        tierLabel: tier.label,
        breakdown: {
            engagement:     { score: Math.round(clamp(engScore, 0, 100)),  weight: '35%', detail: `${analytics.engagementRate}% (benchmark: ${bench.good}–${bench.great}% for ${tier.name})` },
            consistency:    { score: Math.round(clamp(conScore, 0, 100)),  weight: '20%', detail: `${conScore}/100 consistency` },
            frequency:      { score: Math.round(clamp(freqScore, 0, 100)),weight: '15%', detail: `${analytics.postsPerWeek} posts/week` },
            viewToSubRatio: { score: Math.round(clamp(vsScore, 0, 100)),  weight: '15%', detail: `${analytics.viewToSubRatio}% of subs watch each video` },
            audienceSize:   { score: Math.round(clamp(audScore, 0, 100)), weight: '15%', detail: `${fmtNum(subscribers)} subscribers (${tier.name})` },
        },
    };
}

// ─── Partnership Insights ────────────────────────────────────────────────────

/**
 * High-level partnership readiness summary.
 */
export function generatePartnershipInsights(analytics, channelData, creatorFusionScore) {
    const subscribers = safeInt(channelData.statistics?.subscriberCount);
    const tier        = classifyAudienceTier(subscribers);

    const cpmTable = {
        'Nano':     { low: 5,  high: 15 },
        'Micro':    { low: 8,  high: 20 },
        'Mid-Tier': { low: 12, high: 25 },
        'Macro':    { low: 15, high: 30 },
        'Mega':     { low: 20, high: 50 },
    };
    const cpm = cpmTable[tier.name] ?? cpmTable['Mid-Tier'];

    const estLow  = Math.round((analytics.avgViews / 1000) * cpm.low);
    const estHigh = Math.round((analytics.avgViews / 1000) * cpm.high);

    const strengths = [];
    const flags     = [];

    const b = creatorFusionScore.breakdown;
    if (b.engagement.score >= 80)  strengths.push('Exceptional engagement rate for tier');
    if (b.consistency.score >= 80) strengths.push('Very consistent posting schedule');
    if (b.frequency.score >= 80)   strengths.push('Strong posting cadence');
    if (analytics.viewToSubRatio >= 30) strengths.push('High subscriber-to-view conversion');
    if (analytics.viewDistribution?.skewRatio <= 1.5 && analytics.viewDistribution.skewRatio > 0) {
        strengths.push('Consistent video performance (low variance)');
    }

    if (b.engagement.score < 40)           flags.push('Below-average engagement for tier');
    if (analytics.postsPerWeek < 0.5)      flags.push('Infrequent posting (<1 per 2 weeks)');
    if (analytics.postingConsistency < 30) flags.push('Irregular posting schedule');
    if (analytics.viewDistribution?.skewRatio > 3) {
        flags.push('High view variance — possible viral outliers skewing averages');
    }
    if (analytics.viewToSubRatio < 10) flags.push('Low view-to-sub ratio — possible inactive audience');

    const topics = (channelData.topicDetails?.topicCategories ?? []).map((t) =>
        t.replace('https://en.wikipedia.org/wiki/', '').replace(/_/g, ' '),
    );

    return {
        estimatedSponsoredPostValue: {
            low: estLow,
            high: estHigh,
            currency: 'USD',
            note: 'Based on industry CPM averages. Actual rates vary by niche.',
        },
        strengths,
        flags,
        contentCategories: topics,
        recommendedForBrands: creatorFusionScore.score >= 50 && flags.length <= 1,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyAnalytics() {
    return {
        videoCount: 0, engagementRate: 0, avgViews: 0, avgLikes: 0, avgComments: 0,
        likeToViewRatio: 0, commentToViewRatio: 0, viewToSubRatio: 0,
        postsPerWeek: 0, postingConsistency: 0,
        topPerformingVideo: null, worstPerformingVideo: null, viewDistribution: null,
    };
}

function videoSummary(v) {
    if (!v) return null;
    return {
        title: v.title,
        videoId: v.videoId,
        url: `https://youtube.com/watch?v=${v.videoId}`,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        engagementRate: r2(v.engagement),
        publishedAt: v.publishedAt.toISOString().split('T')[0],
    };
}

function scoreToGrade(s) {
    if (s >= 90) return 'A+';
    if (s >= 80) return 'A';
    if (s >= 70) return 'B+';
    if (s >= 60) return 'B';
    if (s >= 50) return 'C+';
    if (s >= 40) return 'C';
    if (s >= 30) return 'D';
    return 'F';
}

/** Parse string-or-number to integer, defaulting to 0. */
function safeInt(val) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : 0;
}

function r2(n)         { return Math.round(n * 100) / 100; }
function clamp(n, a, b){ return Math.min(Math.max(n, a), b); }

function sum(arr, key) {
    if (typeof key === 'string') return arr.reduce((s, v) => s + (v[key] ?? 0), 0);
    return arr.reduce((s, v) => s + v, 0);
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function fmtNum(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

/** Parse ISO 8601 duration (e.g. PT1H2M30S) to total seconds. */
function parseDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || '0', 10) * 3600)
         + (parseInt(m[2] || '0', 10) * 60)
         + parseInt(m[3] || '0', 10);
}
