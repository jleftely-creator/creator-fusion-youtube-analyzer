import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSponsorships } from '../sponsorship.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeVideo(description, overrides = {}) {
    return {
        videoId: overrides.videoId ?? 'vid_001',
        title: overrides.title ?? 'Test Video',
        description,
        tags: overrides.tags ?? [],
        publishedAt: new Date(overrides.publishedAt ?? '2025-01-15T12:00:00Z'),
    };
}

// ─── detectSponsorships ──────────────────────────────────────────────────────

describe('detectSponsorships', () => {
    it('should return empty report for empty video array', () => {
        const result = detectSponsorships([]);
        assert.equal(result.totalVideosScanned, 0);
        assert.equal(result.totalDetected, 0);
        assert.deepEqual(result.detectedBrands, []);
    });

    it('should detect "sponsored by BRAND" pattern and extract brand', () => {
        const videos = [makeVideo('This video is sponsored by NordVPN. Get 70% off!')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        const brands = result.detectedBrands.map((b) => b.brand);
        assert.ok(brands.some((b) => b.includes('NordVPN')), `Expected NordVPN in brands: ${JSON.stringify(brands)}`);
    });

    it('should detect "brought to you by BRAND" and extract brand', () => {
        const videos = [makeVideo('This episode is brought to you by Squarespace. Build your website today.')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        const brands = result.detectedBrands.map((b) => b.brand);
        assert.ok(brands.some((b) => b.includes('Squarespace')), `Expected Squarespace in brands: ${JSON.stringify(brands)}`);
    });

    it('should detect "thanks to BRAND for sponsoring" and extract brand', () => {
        const videos = [makeVideo('Huge thanks to Surfshark for sponsoring this video!')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        const brands = result.detectedBrands.map((b) => b.brand);
        assert.ok(brands.some((b) => b.includes('Surfshark')), `Expected Surfshark in brands: ${JSON.stringify(brands)}`);
    });

    it('should detect "thank to BRAND for sponsor" variant', () => {
        const videos = [makeVideo('Thank to HelloFresh for sponsoring today.')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        const brands = result.detectedBrands.map((b) => b.brand);
        assert.ok(brands.some((b) => b.includes('HelloFresh')), `Expected HelloFresh in brands: ${JSON.stringify(brands)}`);
    });

    it('should detect FTC disclosure hashtags', () => {
        const videos = [makeVideo('#ad Check out this awesome product! #sponsored')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        assert.equal(result.hasProperDisclosure, true);
    });

    it('should detect affiliate links', () => {
        const videos = [makeVideo('Check it out: https://amzn.to/3abc123')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        assert.ok(result.affiliateNetworks.includes('Amazon Associates'));
    });

    it('should detect promo codes', () => {
        const videos = [makeVideo('Use code TECHGUY20 for 20% off!')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 1);
        assert.ok(result.promoCodes.includes('TECHGUY20'));
    });

    it('should filter out generic words from promo codes', () => {
        const videos = [makeVideo('Use code THE for discount. Also code FOR works.')];
        const result = detectSponsorships(videos);
        assert.ok(!result.promoCodes.includes('THE'));
        assert.ok(!result.promoCodes.includes('FOR'));
    });

    it('should compute sponsorship rate correctly', () => {
        const videos = [
            makeVideo('Sponsored by BrandA.', { videoId: 'v1' }),
            makeVideo('No sponsorship here.', { videoId: 'v2' }),
            makeVideo('No sponsorship here either.', { videoId: 'v3' }),
            makeVideo('Thanks to BrandB for sponsoring!', { videoId: 'v4' }),
        ];
        const result = detectSponsorships(videos);
        assert.equal(result.totalVideosScanned, 4);
        assert.equal(result.totalDetected, 2);
        assert.equal(result.sponsorshipRate, 50);
    });

    it('should detect new affiliate patterns: Fiverr, Canva, Monday.com, Notion', () => {
        const videos = [
            makeVideo('Check out https://fiverr.com/myprofile for freelance work', { videoId: 'v1' }),
            makeVideo('Design with https://canva.com/templates today', { videoId: 'v2' }),
            makeVideo('Manage projects at https://monday.com/signup', { videoId: 'v3' }),
            makeVideo('Organize your life with https://notion.so/templates', { videoId: 'v4' }),
        ];
        const result = detectSponsorships(videos);
        assert.ok(result.affiliateNetworks.includes('Fiverr'), 'Should detect Fiverr');
        assert.ok(result.affiliateNetworks.includes('Canva'), 'Should detect Canva');
        assert.ok(result.affiliateNetworks.includes('Monday.com'), 'Should detect Monday.com');
        assert.ok(result.affiliateNetworks.includes('Notion'), 'Should detect Notion');
    });

    it('should not detect sponsorship in clean descriptions', () => {
        const videos = [makeVideo('Just a regular video about cooking pasta at home.')];
        const result = detectSponsorships(videos);
        assert.equal(result.totalDetected, 0);
        assert.deepEqual(result.detectedBrands, []);
    });

    it('should aggregate brand mentions by frequency', () => {
        const videos = [
            makeVideo('Sponsored by NordVPN. Get a deal!', { videoId: 'v1' }),
            makeVideo('Sponsored by NordVPN. Another great deal!', { videoId: 'v2' }),
            makeVideo('Sponsored by Squarespace. Build something.', { videoId: 'v3' }),
        ];
        const result = detectSponsorships(videos);
        assert.equal(result.detectedBrands[0].brand, 'NordVPN');
        assert.equal(result.detectedBrands[0].mentionCount, 2);
    });
});
