import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRateCard } from '../rate-card.js';

describe('generateRateCard', () => {
    it('should include currency field set to USD', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: ['Technology'],
        });
        assert.equal(card.currency, 'USD');
    });

    it('should include all rate types', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: [],
        });
        assert.ok(card.estimatedIntegrationRate);
        assert.ok(card.estimatedDedicatedRate);
        assert.ok(card.estimatedShortsRate);
        assert.ok(card.usageRightsAddon);
    });

    it('should have low ≤ mid ≤ high for each rate type', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: [],
        });
        for (const key of ['estimatedIntegrationRate', 'estimatedDedicatedRate', 'estimatedShortsRate']) {
            const rate = card[key];
            assert.ok(rate.low <= rate.mid, `${key}: low (${rate.low}) should be ≤ mid (${rate.mid})`);
            assert.ok(rate.mid <= rate.high, `${key}: mid (${rate.mid}) should be ≤ high (${rate.high})`);
        }
    });

    it('should apply niche multiplier for Technology', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: ['Technology'],
        });
        assert.equal(card.adjustments.niche.category, 'Technology');
        assert.equal(card.adjustments.niche.multiplier, 1.3);
    });

    it('should produce brand deal experience from sponsorship data', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: [],
            sponsorship: { totalDetected: 12 },
        });
        assert.ok(card.brandDealExperience.includes('Very experienced'));
    });

    it('should default to Unknown brand experience without sponsorship data', () => {
        const card = generateRateCard({
            avgViews: 50000,
            subscribers: 100000,
            tier: 'Mid-Tier',
            engagementRate: 4.5,
            creatorFusionScore: 72,
            contentCategories: [],
        });
        assert.equal(card.brandDealExperience, 'Unknown');
    });
});
