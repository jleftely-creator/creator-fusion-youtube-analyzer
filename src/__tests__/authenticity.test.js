import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAuthenticity } from '../authenticity.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeVideo(overrides = {}) {
    return {
        videoId: overrides.videoId ?? 'vid_001',
        views: overrides.views ?? 10000,
        likes: overrides.likes ?? 500,
        comments: overrides.comments ?? 50,
        likesDisabled: overrides.likesDisabled ?? false,
        commentsDisabled: overrides.commentsDisabled ?? false,
    };
}

const channelStats = {
    subscriberCount: '50000',
    viewCount: '5000000',
    videoCount: '200',
};

// ─── analyzeAuthenticity ─────────────────────────────────────────────────────

describe('analyzeAuthenticity', () => {
    it('should return null score with status for < 3 videos', () => {
        const videos = [makeVideo(), makeVideo({ videoId: 'v2' })];
        const result = analyzeAuthenticity(videos, channelStats);
        assert.equal(result.score, null);
        assert.equal(result.status, 'insufficient_data');
        assert.equal(result.label, 'Insufficient data');
    });

    it('should return null score with status for < 3 videos with 100+ views', () => {
        const videos = [
            makeVideo({ views: 150, videoId: 'v1' }),
            makeVideo({ views: 50, videoId: 'v2' }),
            makeVideo({ views: 30, videoId: 'v3' }),
            makeVideo({ views: 10, videoId: 'v4' }),
        ];
        const result = analyzeAuthenticity(videos, channelStats);
        assert.equal(result.score, null);
        assert.equal(result.status, 'insufficient_data');
    });

    it('should return a numeric score for sufficient data', () => {
        const videos = Array.from({ length: 10 }, (_, i) => makeVideo({
            videoId: `v${i}`,
            views: 5000 + Math.random() * 10000,
            likes: 200 + Math.random() * 300,
            comments: 20 + Math.random() * 50,
        }));
        const result = analyzeAuthenticity(videos, channelStats);
        assert.ok(typeof result.score === 'number', `Expected numeric score, got ${result.score}`);
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.ok(!result.status, 'Should not have status field when score is computed');
    });

    it('should return high score for authentic-looking engagement', () => {
        // Natural variance in views, healthy comment-to-like ratios (1–10 per 100 likes)
        const videos = [
            makeVideo({ videoId: 'v1', views: 15000, likes: 600, comments: 40 }),
            makeVideo({ videoId: 'v2', views: 8000,  likes: 250, comments: 15 }),
            makeVideo({ videoId: 'v3', views: 22000, likes: 1100, comments: 70 }),
            makeVideo({ videoId: 'v4', views: 5000,  likes: 180, comments: 12 }),
            makeVideo({ videoId: 'v5', views: 35000, likes: 1500, comments: 95 }),
        ];
        const result = analyzeAuthenticity(videos, channelStats);
        assert.ok(result.score >= 85, `Expected high authenticity (≥85), got ${result.score}`);
    });

    it('should flag suspiciously consistent like-to-view ratios', () => {
        // All videos have exactly 5% like rate — bot-like
        const videos = Array.from({ length: 10 }, (_, i) => makeVideo({
            videoId: `v${i}`,
            views: 10000,
            likes: 500,
            comments: 50,
        }));
        const result = analyzeAuthenticity(videos, channelStats);
        assert.ok(result.score < 100);
        assert.ok(result.flags.some((f) => f.signal.includes('like-to-view ratio')));
    });

    it('should flag low lifetime views per subscriber', () => {
        const videos = Array.from({ length: 5 }, (_, i) => makeVideo({
            videoId: `v${i}`,
            views: 1000 + i * 500,
            likes: 50 + i * 20,
            comments: 10 + i * 5,
        }));
        // Very low views compared to subscribers
        const suspiciousStats = { subscriberCount: '500000', viewCount: '100000', videoCount: '50' };
        const result = analyzeAuthenticity(videos, suspiciousStats);
        assert.ok(result.flags.some((f) => f.signal.includes('views per subscriber')));
    });

    it('should include videosAnalyzed count', () => {
        const videos = Array.from({ length: 5 }, (_, i) => makeVideo({
            videoId: `v${i}`,
            views: 1000 + i * 1000,
            likes: 100 + i * 50,
            comments: 10 + i * 10,
        }));
        const result = analyzeAuthenticity(videos, channelStats);
        assert.equal(result.videosAnalyzed, 5);
    });
});
