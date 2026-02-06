/**
 * Engagement Authenticity Engine
 *
 * Detects potentially inauthentic engagement using statistical analysis
 * of video-level metrics. Flags include:
 *
 *   - Unnaturally consistent like-to-view ratios (bot signature)
 *   - Sudden subscriber spikes without corresponding view growth
 *   - Comment-to-like ratios far outside normal ranges
 *   - Zero-comment videos with high like counts (like bots, no comments)
 *   - Engagement that doesn't scale naturally with views
 *
 * No extra API calls — computed entirely from data already fetched.
 *
 * Score: 0–100 (higher = more authentic)
 *
 * © 2025 Creator Fusion LLC
 */

// ─── Normal ranges for YouTube (derived from industry research) ──────────────

/**
 * Expected coefficient of variation (stdDev / mean) for like-to-view ratios
 * across a channel's videos. Natural channels show CV of 0.3–0.8.
 * Bot-boosted channels often show CV < 0.15 (suspiciously consistent).
 */
const NATURAL_LVR_CV_MIN = 0.15;

/**
 * Normal comment-to-like ratio range.
 * Most channels fall between 1–10 comments per 100 likes.
 * Very low (< 0.5%) suggests comment bots weren't purchased alongside like bots.
 * Very high (> 20%) can indicate comment spam or engagement pods.
 */
const NORMAL_CTL_MIN = 0.5;   // comments per 100 likes
const NORMAL_CTL_MAX = 20.0;

/**
 * Maximum acceptable ratio of (channel total views / subscriber count).
 * Channels with < 5 views per subscriber lifetime are suspicious if they
 * have a high sub count, suggesting bought subscribers.
 */
const MIN_VIEWS_PER_SUB = 5;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run authenticity analysis on parsed video data and channel stats.
 *
 * @param {Array<ParsedVideo>} videos — from parseVideos()
 * @param {{ subscriberCount: string|number, viewCount: string|number, videoCount: string|number }} channelStats
 * @returns {AuthenticityReport}
 */
export function analyzeAuthenticity(videos, channelStats) {
    if (videos.length < 3) {
        return {
            score: null,
            status: 'insufficient_data',
            label: 'Insufficient data',
            note: 'Need at least 3 videos with engagement data for authenticity analysis.',
            flags: [],
            signals: {},
        };
    }

    const subscribers  = safeInt(channelStats.subscriberCount);
    const totalViews   = safeInt(channelStats.viewCount);
    const flags        = [];
    const signals      = {};
    let   deductions   = 0;

    // Filter to videos with meaningful view counts (> 100 views)
    const eligible = videos.filter((v) => v.views >= 100);
    if (eligible.length < 3) {
        return {
            score: null,
            status: 'insufficient_data',
            label: 'Insufficient data',
            note: 'Need at least 3 videos with 100+ views for authenticity analysis.',
            flags: [],
            signals: {},
        };
    }

    // ── Signal 1: Like-to-view ratio consistency ─────────────────────────────
    // Bots apply likes at a fixed rate → unnaturally low variance
    const lvrs = eligible
        .filter((v) => !v.likesDisabled && v.views > 0)
        .map((v) => v.likes / v.views);

    if (lvrs.length >= 3) {
        const cv = coefficientOfVariation(lvrs);
        signals.likeConsistency = {
            coefficientOfVariation: r2(cv),
            naturalRange: `${NATURAL_LVR_CV_MIN}–0.8`,
        };

        if (cv < NATURAL_LVR_CV_MIN) {
            flags.push({
                severity: 'high',
                signal: 'Suspiciously consistent like-to-view ratio',
                detail: `CV of ${r2(cv)} across ${lvrs.length} videos (natural channels show 0.15–0.8). May indicate automated like boosting.`,
            });
            deductions += 30;
        } else if (cv < 0.20) {
            flags.push({
                severity: 'medium',
                signal: 'Unusually consistent like-to-view ratio',
                detail: `CV of ${r2(cv)} is on the low end of normal.`,
            });
            deductions += 10;
        }
    }

    // ── Signal 2: Comment-to-like ratio ──────────────────────────────────────
    // Like bots rarely purchase comment bots simultaneously
    const totalLikes    = eligible.reduce((s, v) => s + v.likes, 0);
    const totalComments = eligible.reduce((s, v) => s + v.comments, 0);

    if (totalLikes > 0) {
        const ctl = (totalComments / totalLikes) * 100; // comments per 100 likes
        signals.commentToLikeRatio = {
            value: r2(ctl),
            normalRange: `${NORMAL_CTL_MIN}–${NORMAL_CTL_MAX}`,
        };

        if (ctl < NORMAL_CTL_MIN) {
            flags.push({
                severity: 'high',
                signal: 'Abnormally low comment-to-like ratio',
                detail: `${r2(ctl)} comments per 100 likes (normal: ${NORMAL_CTL_MIN}–${NORMAL_CTL_MAX}). Likes may be inflated without corresponding real engagement.`,
            });
            deductions += 25;
        } else if (ctl > NORMAL_CTL_MAX) {
            flags.push({
                severity: 'medium',
                signal: 'Unusually high comment-to-like ratio',
                detail: `${r2(ctl)} comments per 100 likes. May indicate comment bots or engagement pods.`,
            });
            deductions += 15;
        }
    }

    // ── Signal 3: Subscriber-to-view ratio (lifetime) ────────────────────────
    // Bought subscribers don't watch videos
    if (subscribers > 1000 && totalViews > 0) {
        const viewsPerSub = totalViews / subscribers;
        signals.lifetimeViewsPerSubscriber = {
            value: r2(viewsPerSub),
            minimum: MIN_VIEWS_PER_SUB,
        };

        if (viewsPerSub < MIN_VIEWS_PER_SUB) {
            flags.push({
                severity: 'high',
                signal: 'Very low lifetime views per subscriber',
                detail: `${r2(viewsPerSub)} views per subscriber (healthy channels typically exceed ${MIN_VIEWS_PER_SUB}). May indicate purchased subscribers.`,
            });
            deductions += 25;
        }
    }

    // ── Signal 4: Zero-comment videos with high engagement ───────────────────
    const zeroCommentHighLikes = eligible.filter(
        (v) => v.comments === 0 && !v.commentsDisabled && v.likes > 50,
    );

    if (zeroCommentHighLikes.length > 0) {
        const pct = Math.round((zeroCommentHighLikes.length / eligible.length) * 100);
        signals.zeroCommentHighEngagement = {
            count: zeroCommentHighLikes.length,
            percentOfVideos: pct,
        };

        if (pct >= 30) {
            flags.push({
                severity: 'medium',
                signal: 'Many videos have likes but zero comments',
                detail: `${zeroCommentHighLikes.length}/${eligible.length} videos (${pct}%) have 50+ likes but 0 comments. Real viewers who like videos occasionally comment.`,
            });
            deductions += 15;
        }
    }

    // ── Signal 5: View count distribution anomalies ──────────────────────────
    // Bought views create unnaturally flat distributions
    const viewCounts = eligible.map((v) => v.views);
    const viewCV = coefficientOfVariation(viewCounts);
    signals.viewCountVariation = { coefficientOfVariation: r2(viewCV) };

    if (viewCV < 0.1 && eligible.length >= 5) {
        flags.push({
            severity: 'medium',
            signal: 'Unnaturally consistent view counts',
            detail: `View count CV of ${r2(viewCV)} across ${eligible.length} videos. Natural channels show much higher variation.`,
        });
        deductions += 15;
    }

    // ── Compute final score ──────────────────────────────────────────────────
    const score = Math.max(0, 100 - deductions);

    return {
        score,
        label: labelScore(score),
        flags,
        signals,
        videosAnalyzed: eligible.length,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function coefficientOfVariation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
}

function labelScore(score) {
    if (score >= 85) return 'High authenticity — no significant red flags';
    if (score >= 65) return 'Moderate authenticity — minor concerns detected';
    if (score >= 40) return 'Low authenticity — multiple red flags present';
    return 'Very low authenticity — strong indicators of inauthentic engagement';
}

function safeInt(val) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : 0;
}

function r2(n) { return Math.round(n * 100) / 100; }
