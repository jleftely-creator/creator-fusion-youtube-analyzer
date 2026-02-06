import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideos, calculateCreatorFusionScore, analyzeVideos } from '../analytics.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRawVideo(overrides = {}) {
    return {
        id: overrides.id ?? 'vid_001',
        snippet: {
            title: overrides.title ?? 'Test Video',
            description: overrides.description ?? '',
            tags: overrides.tags ?? [],
            publishedAt: overrides.publishedAt ?? '2025-01-15T12:00:00Z',
        },
        statistics: {
            viewCount: String(overrides.views ?? 10000),
            likeCount: String(overrides.likes ?? 500),
            commentCount: String(overrides.comments ?? 50),
        },
        contentDetails: {
            duration: overrides.duration ?? 'PT10M30S',
        },
    };
}

function makeRawVideos(count, baseOverrides = {}) {
    return Array.from({ length: count }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return makeRawVideo({
            id: `vid_${String(i + 1).padStart(3, '0')}`,
            publishedAt: `2025-01-${day}T12:00:00Z`,
            ...baseOverrides,
        });
    });
}

// ─── parseVideos ─────────────────────────────────────────────────────────────

describe('parseVideos', () => {
    it('should parse raw videos into normalized objects', () => {
        const raw = [makeRawVideo()];
        const parsed = parseVideos(raw);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].videoId, 'vid_001');
        assert.equal(parsed[0].views, 10000);
        assert.equal(parsed[0].likes, 500);
        assert.equal(parsed[0].comments, 50);
        assert.equal(parsed[0].title, 'Test Video');
    });

    it('should filter out videos with invalid dates', () => {
        const raw = [makeRawVideo({ publishedAt: 'invalid-date' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed.length, 0);
    });

    it('should set isShort=true for videos ≤ 60s', () => {
        const raw = [makeRawVideo({ duration: 'PT45S' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].isShort, true);
        assert.equal(parsed[0].durationSeconds, 45);
    });

    it('should set isShort=true for exactly 60s', () => {
        const raw = [makeRawVideo({ duration: 'PT1M' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].isShort, true);
        assert.equal(parsed[0].durationSeconds, 60);
    });

    it('should set isShort=false for videos > 60s', () => {
        const raw = [makeRawVideo({ duration: 'PT2M30S' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].isShort, false);
        assert.equal(parsed[0].durationSeconds, 150);
    });

    it('should set isShort=false for PT0S (no duration data)', () => {
        const raw = [makeRawVideo({ duration: 'PT0S' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].isShort, false);
        assert.equal(parsed[0].durationSeconds, 0);
    });

    it('should parse hours correctly', () => {
        const raw = [makeRawVideo({ duration: 'PT1H2M30S' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].durationSeconds, 3750);
        assert.equal(parsed[0].isShort, false);
    });

    it('should parse day component in duration (P1DT12H)', () => {
        const raw = [makeRawVideo({ duration: 'P1DT12H' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].durationSeconds, 86400 + 43200); // 1 day + 12 hours
        assert.equal(parsed[0].isShort, false);
    });

    it('should parse day-only duration (P2D)', () => {
        const raw = [makeRawVideo({ duration: 'P2D' })];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].durationSeconds, 172800); // 2 days
        assert.equal(parsed[0].isShort, false);
    });

    it('should sort videos by publishedAt descending', () => {
        const raw = [
            makeRawVideo({ id: 'old', publishedAt: '2025-01-01T00:00:00Z' }),
            makeRawVideo({ id: 'new', publishedAt: '2025-01-15T00:00:00Z' }),
        ];
        const parsed = parseVideos(raw);
        assert.equal(parsed[0].videoId, 'new');
        assert.equal(parsed[1].videoId, 'old');
    });
});

// ─── calculateCreatorFusionScore ─────────────────────────────────────────────

describe('calculateCreatorFusionScore', () => {
    it('should return a score between 0 and 100', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 50000);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '50000' });

        assert.ok(result.score >= 0 && result.score <= 100, `Score ${result.score} out of range`);
    });

    it('should return a valid grade', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 50000);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '50000' });

        const validGrades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
        assert.ok(validGrades.includes(result.grade), `Invalid grade: ${result.grade}`);
    });

    it('should classify tier correctly', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 50000);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '50000' });

        assert.equal(result.tier, 'Mid-Tier');
    });

    it('should include all breakdown components', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 50000);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '50000' });

        assert.ok(result.breakdown.engagement);
        assert.ok(result.breakdown.consistency);
        assert.ok(result.breakdown.frequency);
        assert.ok(result.breakdown.viewToSubRatio);
        assert.ok(result.breakdown.audienceSize);
    });

    it('should produce higher scores for channels with better engagement', () => {
        const lowEngRaw = makeRawVideos(10, { views: 10000, likes: 10, comments: 1 });
        const highEngRaw = makeRawVideos(10, { views: 10000, likes: 800, comments: 100 });

        const lowParsed = parseVideos(lowEngRaw);
        const highParsed = parseVideos(highEngRaw);

        const lowAnalytics = analyzeVideos(lowParsed, 50000);
        const highAnalytics = analyzeVideos(highParsed, 50000);

        const lowScore = calculateCreatorFusionScore(lowAnalytics, { subscriberCount: '50000' });
        const highScore = calculateCreatorFusionScore(highAnalytics, { subscriberCount: '50000' });

        assert.ok(highScore.score > lowScore.score,
            `High engagement score (${highScore.score}) should be > low (${lowScore.score})`);
    });

    it('should classify Nano tier correctly', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 500);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '500' });
        assert.equal(result.tier, 'Nano');
    });

    it('should classify Mega tier correctly', () => {
        const parsed = parseVideos(makeRawVideos(10));
        const analytics = analyzeVideos(parsed, 2000000);
        const result = calculateCreatorFusionScore(analytics, { subscriberCount: '2000000' });
        assert.equal(result.tier, 'Mega');
    });
});
