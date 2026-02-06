/**
 * YouTube Data API v3 Client
 *
 * Lightweight HTTP-only wrapper. No browser, no proxies.
 *
 * Quota costs (per call):
 *   channels.list    = 1 unit
 *   playlistItems    = 1 unit
 *   videos.list      = 1 unit
 *   search.list      = 100 units (never used — playlistItems is cheaper)
 *
 * Per-channel cost: ~3–5 units depending on video count
 * Daily capacity:   ~2,500 channels on the free 10,000-unit tier
 *
 * © 2025 Creator Fusion LLC
 */

import { gotScraping } from 'got-scraping';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

/** Retry delays in ms for transient failures */
const RETRY_DELAYS = [500, 1500];

export class YouTubeClient {
    /** @param {string} apiKey */
    constructor(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('YouTube API key is required and must be a string.');
        }
        this.apiKey = apiKey.trim();
        this.quotaUsed = 0;
        this.requestCount = 0;
        this.errors = [];
        /** @type {Map<string, string|null>} handle → channelId cache */
        this._channelIdCache = new Map();
    }

    /**
     * Internal request with quota tracking, retries, and structured errors.
     *
     * @param {string} endpoint
     * @param {Record<string, string | number | undefined>} params
     * @param {number} quotaCost
     * @returns {Promise<Record<string, any>>}
     */
    async _request(endpoint, params, quotaCost = 1) {
        const url = new URL(`${API_BASE}/${endpoint}`);
        url.searchParams.set('key', this.apiKey);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }

        let lastError = null;

        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
            try {
                const response = await gotScraping({
                    url: url.toString(),
                    responseType: 'json',
                    timeout: { request: 20_000 },
                });

                this.quotaUsed += quotaCost;
                this.requestCount++;
                return response.body;
            } catch (error) {
                lastError = error;
                const status = error?.response?.statusCode;
                const body = error?.response?.body;

                // Non-retryable errors — fail immediately
                if (status === 403) {
                    const reason = body?.error?.errors?.[0]?.reason;
                    if (reason === 'quotaExceeded') {
                        throw new Error(
                            'YouTube API daily quota exceeded (10,000 units). '
                            + 'Try again tomorrow or use a different API key.',
                        );
                    }
                    if (reason === 'forbidden') {
                        throw new Error(
                            'YouTube Data API v3 is not enabled for this key. '
                            + 'Enable it at https://console.cloud.google.com/apis/library/youtube.googleapis.com',
                        );
                    }
                    throw new Error(`API access denied: ${reason || body?.error?.message || 'unknown reason'}`);
                }

                if (status === 400) {
                    throw new Error(`Bad request: ${body?.error?.message || 'invalid parameters'}`);
                }

                if (status === 404) {
                    throw new Error(`Endpoint not found: ${endpoint}`);
                }

                // Retryable: 429 (rate limit), 500, 503
                if (attempt < RETRY_DELAYS.length) {
                    await sleep(RETRY_DELAYS[attempt]);
                    continue;
                }
            }
        }

        throw new Error(
            `YouTube API request failed after ${RETRY_DELAYS.length + 1} attempts: `
            + `${lastError?.response?.statusCode || 'network error'} — ${lastError?.message}`,
        );
    }

    /**
     * Resolve a channel input (URL, @handle, or raw ID) to a channel ID.
     * Costs 1–2 quota units depending on whether the forHandle fallback is needed.
     *
     * @param {string} input
     * @returns {Promise<string | null>} Channel ID or null
     */
    async resolveChannelId(input) {
        if (!input || typeof input !== 'string') return null;
        const trimmed = input.trim();
        if (!trimmed || trimmed.length > 300) return null;

        // Reject inputs with characters that can't appear in URLs or handles
        if (/[<>"{}|\\^`\x00-\x1f]/.test(trimmed)) return null;

        // Already a channel ID
        if (/^UC[\w-]{22}$/.test(trimmed)) return trimmed;

        // Extract from URL variants
        const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
        if (channelIdMatch) return channelIdMatch[1];

        // Determine handle to look up
        let handle = null;
        const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/i);
        const customMatch = trimmed.match(/youtube\.com\/c\/([\w.-]+)/i);

        if (handleMatch) {
            handle = handleMatch[1];
        } else if (customMatch) {
            handle = customMatch[1];
        } else if (trimmed.startsWith('@')) {
            handle = trimmed.substring(1);
        } else if (!trimmed.includes('/') && !trimmed.includes('.')) {
            handle = trimmed;
        }

        if (!handle || handle.length > 100 || !/^[\w.-]+$/.test(handle)) return null;

        // Check cache first to save quota
        const cacheKey = handle.toLowerCase();
        if (this._channelIdCache.has(cacheKey)) {
            return this._channelIdCache.get(cacheKey);
        }

        // Try forHandle first (modern channels, 2023+)
        const data = await this._request('channels', { part: 'id', forHandle: handle }, 1);
        if (data.items?.length > 0) {
            const id = data.items[0].id;
            this._channelIdCache.set(cacheKey, id);
            return id;
        }

        // Fallback to forUsername (legacy channels)
        const legacy = await this._request('channels', { part: 'id', forUsername: handle }, 1);
        if (legacy.items?.length > 0) {
            const id = legacy.items[0].id;
            this._channelIdCache.set(cacheKey, id);
            return id;
        }

        this._channelIdCache.set(cacheKey, null);
        return null;
    }

    /**
     * Fetch full channel details including statistics, branding, and topics.
     * Cost: 1 unit
     *
     * @param {string} channelId
     * @returns {Promise<Record<string, any> | null>}
     */
    async getChannel(channelId) {
        const data = await this._request('channels', {
            part: 'snippet,statistics,contentDetails,brandingSettings,topicDetails',
            id: channelId,
        }, 1);
        return data.items?.[0] ?? null;
    }

    /**
     * Fetch recent video IDs from a channel's uploads playlist.
     * Cost: 1 unit per 50 videos
     *
     * @param {string} uploadsPlaylistId
     * @param {number} maxResults
     * @returns {Promise<Array<{ videoId: string, publishedAt: string }>>}
     */
    async getRecentVideoIds(uploadsPlaylistId, maxResults = 30) {
        const videos = [];
        let pageToken = undefined;

        while (videos.length < maxResults) {
            const perPage = Math.min(50, maxResults - videos.length);

            const data = await this._request('playlistItems', {
                part: 'contentDetails',
                playlistId: uploadsPlaylistId,
                maxResults: perPage,
                pageToken,
            }, 1);

            if (!data.items?.length) break;

            for (const item of data.items) {
                videos.push({
                    videoId: item.contentDetails.videoId,
                    publishedAt: item.contentDetails.videoPublishedAt,
                });
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        return videos;
    }

    /**
     * Fetch full video details in batches of 50.
     * Includes snippet (title, description, tags) + statistics + contentDetails.
     * Cost: 1 unit per 50 videos
     *
     * @param {string[]} videoIds
     * @returns {Promise<Array<Record<string, any>>>}
     */
    async getVideoDetails(videoIds) {
        if (!videoIds.length) return [];

        const results = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const data = await this._request('videos', {
                part: 'snippet,statistics,contentDetails',
                id: batch.join(','),
            }, 1);

            if (data.items) {
                results.push(...data.items);
            }
        }

        return results;
    }

    /** @returns {{ quotaUsed: number, requestCount: number, estimatedRemaining: number, estimatedChannelsRemaining: number }} */
    getQuotaStats() {
        const remaining = Math.max(0, 10_000 - this.quotaUsed);
        return {
            quotaUsed: this.quotaUsed,
            requestCount: this.requestCount,
            estimatedRemaining: remaining,
            estimatedChannelsRemaining: Math.floor(remaining / 4),
        };
    }
}

/** @param {number} ms */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
