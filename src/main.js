/**
 * YouTube Creator Analyzer — Main Entry Point
 *
 * Orchestrates the full analysis pipeline per channel:
 *   1. Resolve channel input → channel ID
 *   2. Fetch channel details + recent videos
 *   3. Compute engagement analytics + Creator Fusion Score™
 *   4. (Optional) Scan for sponsorship indicators
 *   5. (Optional) Run engagement authenticity check
 *   6. (Optional) Generate sponsorship rate card
 *   7. Push structured result to Apify dataset
 *
 * Each channel is processed independently — one failure doesn't stop the batch.
 *
 * © 2025 Creator Fusion LLC
 */

import { Actor, log } from 'apify';
import { YouTubeClient } from './youtube-api.js';
import {
    parseVideos,
    analyzeVideos,
    calculateCreatorFusionScore,
    generatePartnershipInsights,
    classifyAudienceTier,
} from './analytics.js';
import { detectSponsorships } from './sponsorship.js';
import { analyzeAuthenticity } from './authenticity.js';
import { generateRateCard } from './rate-card.js';

await Actor.init();

try {
    // ── Validate input ───────────────────────────────────────────────────────
    const input = await Actor.getInput();

    if (!input?.apiKey) {
        throw new Error(
            'Missing required input: apiKey. '
            + 'Get a free YouTube Data API v3 key at https://console.cloud.google.com/apis/library/youtube.googleapis.com',
        );
    }

    const channels = input.channels ?? [];
    if (!channels.length) {
        throw new Error('Missing required input: channels. Provide at least one channel URL, @handle, or channel ID.');
    }

    const videosPerChannel            = Math.min(Math.max(input.videosPerChannel ?? 30, 5), 200);
    const enableSponsorshipDetection  = input.enableSponsorshipDetection !== false;
    const enableAuthenticityCheck     = input.enableAuthenticityCheck !== false;
    const enableRateCard              = input.enableRateCard !== false;
    const minSubscribers              = input.minSubscribers ?? 0;
    const minEngagementRate           = input.minEngagementRate ?? 0;

    log.info('Starting YouTube Creator Analyzer', {
        channelCount: channels.length,
        videosPerChannel,
        features: {
            sponsorship: enableSponsorshipDetection,
            authenticity: enableAuthenticityCheck,
            rateCard: enableRateCard,
        },
    });

    const client = new YouTubeClient(input.apiKey);

    // ── Process each channel ─────────────────────────────────────────────────
    let processed = 0;
    let skipped   = 0;
    let failed    = 0;

    for (const channelInput of channels) {
        try {
            const result = await processChannel(client, channelInput, {
                videosPerChannel,
                enableSponsorshipDetection,
                enableAuthenticityCheck,
                enableRateCard,
                minSubscribers,
                minEngagementRate,
            });

            if (result === null) {
                skipped++;
                continue;
            }

            await Actor.pushData(result);
            processed++;

            log.info(`✓ ${result.channelName} — CF Score: ${result.creatorFusionScore.score} (${result.creatorFusionScore.grade})`, {
                tier: result.creatorFusionScore.tier,
                engagement: `${result.analytics.engagementRate}%`,
            });
        } catch (error) {
            failed++;
            log.warning(`✗ Failed to process "${channelInput}": ${error.message}`);

            // Push error entry so the user knows which channels failed
            await Actor.pushData({
                channelInput,
                error: error.message,
                status: 'failed',
            });
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    const quota = client.getQuotaStats();

    log.info('Analysis complete', {
        processed,
        skipped,
        failed,
        total: channels.length,
        quotaUsed: quota.quotaUsed,
        quotaRemaining: quota.estimatedRemaining,
    });

    // Store summary as a named KV entry for easy access
    await Actor.setValue('SUMMARY', {
        processedChannels: processed,
        skippedChannels: skipped,
        failedChannels: failed,
        totalChannels: channels.length,
        quota,
    });
} catch (error) {
    log.error(`Fatal error: ${error.message}`);
    throw error;
} finally {
    await Actor.exit();
}

// ─── Channel processing pipeline ─────────────────────────────────────────────

/**
 * Full analysis pipeline for a single channel.
 * Returns null if the channel should be skipped (filters), or the result object.
 *
 * @param {YouTubeClient} client
 * @param {string} channelInput
 * @param {object} options
 * @returns {Promise<object | null>}
 */
async function processChannel(client, channelInput, options) {
    const {
        videosPerChannel,
        enableSponsorshipDetection,
        enableAuthenticityCheck,
        enableRateCard,
        minSubscribers,
        minEngagementRate,
    } = options;

    // 1. Resolve channel ID
    log.info(`Resolving channel: ${channelInput}`);
    const channelId = await client.resolveChannelId(channelInput);

    if (!channelId) {
        throw new Error(`Could not resolve channel ID for "${channelInput}". Check the URL, @handle, or channel ID.`);
    }

    // 2. Fetch channel details
    const channelData = await client.getChannel(channelId);
    if (!channelData) {
        throw new Error(`Channel ${channelId} not found or is private.`);
    }

    const channelName  = channelData.snippet?.title ?? 'Unknown';
    const subscribers  = parseInt(channelData.statistics?.subscriberCount ?? '0', 10);
    const hiddenSubs   = channelData.statistics?.hiddenSubscriberCount === true;

    // 3. Apply subscriber filter
    if (minSubscribers > 0 && (hiddenSubs || subscribers < minSubscribers)) {
        log.info(`Skipping ${channelName} — ${hiddenSubs ? 'hidden subscriber count' : `${subscribers} subscribers`} (min: ${minSubscribers})`);
        return null;
    }

    // 4. Fetch recent videos
    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
        throw new Error(`${channelName}: Could not find uploads playlist. Channel may have no public videos.`);
    }

    const videoIds = await client.getRecentVideoIds(uploadsPlaylistId, videosPerChannel);
    if (!videoIds.length) {
        throw new Error(`${channelName}: No videos found in uploads playlist.`);
    }

    const rawVideos = await client.getVideoDetails(videoIds.map((v) => v.videoId));
    const parsed    = parseVideos(rawVideos);

    if (!parsed.length) {
        throw new Error(`${channelName}: All videos had invalid data.`);
    }

    // 5. Core analytics
    const analytics         = analyzeVideos(parsed, subscribers);
    const creatorFusionScore = calculateCreatorFusionScore(analytics, channelData.statistics);
    const partnership       = generatePartnershipInsights(analytics, channelData, creatorFusionScore);

    // 6. Apply engagement rate filter
    if (minEngagementRate > 0 && analytics.engagementRate < minEngagementRate) {
        log.info(`Skipping ${channelName} — engagement ${analytics.engagementRate}% (min: ${minEngagementRate}%)`);
        return null;
    }

    // 7. Optional: Sponsorship detection
    let sponsorship = null;
    if (enableSponsorshipDetection) {
        sponsorship = detectSponsorships(parsed);
    }

    // 8. Optional: Authenticity check
    let authenticity = null;
    if (enableAuthenticityCheck) {
        const result = analyzeAuthenticity(parsed, channelData.statistics);
        // Only include authenticity data when a score was computed;
        // null score means insufficient data — omit from output
        authenticity = result.score !== null ? result : null;
    }

    // 9. Optional: Rate card
    let rateCard = null;
    if (enableRateCard) {
        rateCard = generateRateCard({
            avgViews: analytics.avgViews,
            subscribers,
            tier: creatorFusionScore.tier,
            engagementRate: analytics.engagementRate,
            creatorFusionScore: creatorFusionScore.score,
            contentCategories: partnership.contentCategories,
            sponsorship,
        });
    }

    // 10. Assemble result
    return {
        status: 'success',
        channelId,
        channelName,
        channelUrl: `https://youtube.com/channel/${channelId}`,
        handle: channelData.snippet?.customUrl ?? null,
        description: truncate(channelData.snippet?.description ?? '', 500),
        country: channelData.snippet?.country ?? null,
        subscriberCount: subscribers,
        hiddenSubscriberCount: hiddenSubs,
        totalViews: parseInt(channelData.statistics?.viewCount ?? '0', 10),
        totalVideos: parseInt(channelData.statistics?.videoCount ?? '0', 10),
        joinedDate: channelData.snippet?.publishedAt?.split('T')[0] ?? null,
        thumbnailUrl: channelData.snippet?.thumbnails?.medium?.url ?? null,

        creatorFusionScore,
        analytics: {
            ...analytics,
            // Omit the full video array from the top-level output to keep it clean
            videos: undefined,
        },
        partnership,

        ...(sponsorship  ? { sponsorship }  : {}),
        ...(authenticity ? { authenticity } : {}),
        ...(rateCard     ? { rateCard }     : {}),

        analyzedAt: new Date().toISOString(),
        quotaSnapshot: client.getQuotaStats(),
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
}
