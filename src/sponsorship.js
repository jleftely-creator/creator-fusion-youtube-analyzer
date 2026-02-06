/**
 * Sponsorship Detection Engine
 *
 * Scans video descriptions and tags for sponsorship indicators:
 *   - FTC disclosure hashtags (#ad, #sponsored, #partner)
 *   - Affiliate link patterns (Amazon Associates, ShareASale, etc.)
 *   - Discount/promo code mentions
 *   - Common sponsorship phrases ("brought to you by", "sponsored by")
 *   - Brand @mentions in sponsored context
 *
 * Zero additional API cost — uses description text already fetched.
 *
 * © 2025 Creator Fusion LLC
 */

// ─── Pattern definitions ─────────────────────────────────────────────────────

/** FTC-required disclosure hashtags (case-insensitive) */
const DISCLOSURE_HASHTAGS = [
    '#ad', '#sponsored', '#partner', '#paidpartnership',
    '#collab', '#gifted', '#brandambassador', '#affiliate',
];

/** Regex for common sponsorship phrases in descriptions */
const SPONSORSHIP_PHRASES = [
    /\bsponsored\s+by\b/i,
    /\bbrought\s+to\s+you\s+by\b/i,
    /\bthanks?\s+to\s+[\w]+\s+for\s+sponsor/i,
    /\bthis\s+video\s+is\s+sponsored\b/i,
    /\bpartnership\s+with\b/i,
    /\bpaid\s+promotion\b/i,
    /\bpaid\s+partnership\b/i,
    /\bincludes\s+paid\s+promotion\b/i,
    /\buse\s+(?:my\s+)?(?:code|link)\b/i,
    /\bdiscount\s+code\b/i,
    /\bpromo\s+code\b/i,
    /\bcoupon\s+code\b/i,
    /\bspecial\s+offer\b/i,
    /\bcheck\s+(?:them\s+)?out\s+at\b/i,
    /\bsign\s+up\s+(?:with|using)\s+(?:my|the)\s+link\b/i,
];

/** Affiliate/tracking URL patterns */
const AFFILIATE_PATTERNS = [
    { name: 'Amazon Associates',    pattern: /(?:amzn\.to|amazon\.\w+\/.*[?&]tag=)/i },
    { name: 'ShareASale',           pattern: /shareasale\.com/i },
    { name: 'Impact Radius',        pattern: /(?:impact\.com|goto\.target\.com|pntrs\.com|pntra\.com|pntrac\.com)/i },
    { name: 'CJ Affiliate',         pattern: /(?:cj\.com|commission-junction|anrdoezrs\.net|jdoqocy\.com|dpbolvw\.net|kqzyfj\.com)/i },
    { name: 'Rakuten',              pattern: /(?:rakuten\.com|linksynergy\.com)/i },
    { name: 'PartnerStack',         pattern: /partnerstack\.com/i },
    { name: 'Awin',                 pattern: /(?:awin\.com|awin1\.com)/i },
    { name: 'Bitly (tracking)',     pattern: /bit\.ly\//i },
    { name: 'Linktree',             pattern: /linktr\.ee\//i },
    { name: 'UTM tracking',         pattern: /[?&]utm_(?:source|medium|campaign)=/i },
    { name: 'Geni.us',              pattern: /geni\.us\//i },
    { name: 'LTK/RewardStyle',      pattern: /(?:liketoknow\.it|rstyle\.me|ltk\.app)/i },
    { name: 'Skillshare',           pattern: /skillshare\.com\/.*\?/i },
    { name: 'Squarespace',          pattern: /squarespace\.com\/[\w]+/i },
    { name: 'NordVPN',              pattern: /nordvpn\.com\/[\w]+/i },
    { name: 'ExpressVPN',           pattern: /expressvpn\.com\/[\w]+/i },
    { name: 'Surfshark',            pattern: /surfshark\.(?:com|deals)\/[\w]+/i },
    { name: 'Audible',              pattern: /audible\.com\/[\w]+/i },
    { name: 'Honey/PayPal',         pattern: /joinhoney\.com/i },
    { name: 'Raid Shadow Legends',  pattern: /raid\.plarium/i },
    { name: 'HelloFresh',           pattern: /hellofresh\.com\/[\w]+/i },
    { name: 'Ridge Wallet',         pattern: /ridge\.com\/[\w]+/i },
    { name: 'Manscaped',            pattern: /manscaped\.com\/[\w]+/i },
    { name: 'BetterHelp',           pattern: /betterhelp\.com\/[\w]+/i },
    { name: 'Established Titles',   pattern: /establishedtitles\.com/i },
    { name: 'Athletic Greens/AG1',  pattern: /(?:athleticgreens|drinkag1)\.com/i },
    { name: 'Casetify',             pattern: /casetify\.com\/[\w]+/i },
    { name: 'Fiverr',               pattern: /fiverr\.com\/[\w]+/i },
    { name: 'Canva',                pattern: /canva\.com\/[\w]+/i },
    { name: 'Monday.com',           pattern: /monday\.com\/[\w]+/i },
    { name: 'Notion',               pattern: /notion\.so\/[\w]+/i },
];

/** Promo code pattern: "code WORD" or "code: WORD" */
const PROMO_CODE_REGEX = /\bcode[:\s]+([A-Z0-9_-]{3,20})\b/gi;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyze an array of parsed videos for sponsorship signals.
 *
 * @param {Array<{ videoId: string, title: string, description: string, tags: string[], publishedAt: Date }>} videos
 * @returns {SponsorshipReport}
 */
export function detectSponsorships(videos) {
    if (!videos.length) return emptyReport();

    const sponsoredVideos = [];
    const brandMentions   = new Map();  // brand → count
    const promoCodes      = new Set();
    const affiliateNets   = new Set();
    let   disclosureCount = 0;

    for (const video of videos) {
        const desc = video.description ?? '';
        const lowerDesc = desc.toLowerCase();
        const signals = [];

        // 1. Check disclosure hashtags
        for (const tag of DISCLOSURE_HASHTAGS) {
            if (lowerDesc.includes(tag)) {
                signals.push({ type: 'disclosure', value: tag });
                disclosureCount++;
            }
        }

        // 2. Check sponsorship phrases
        for (const rx of SPONSORSHIP_PHRASES) {
            const match = desc.match(rx);
            if (match) {
                signals.push({ type: 'phrase', value: match[0].trim() });

                // Try to extract brand name from sponsorship patterns
                const brandMatch = desc.match(/(?:sponsored|brought\s+to\s+you)\s+by\s+([\w\s&'.]+?)(?:\.|,|!|\n|$)/i)
                    ?? desc.match(/\bthanks?\s+to\s+([\w\s&'.]+?)\s+for\s+sponsor/i);
                if (brandMatch) {
                    const brand = brandMatch[1].trim();
                    if (brand.length >= 2 && brand.length <= 40) {
                        brandMentions.set(brand, (brandMentions.get(brand) ?? 0) + 1);
                    }
                }
                break; // one phrase match per video is enough
            }
        }

        // 3. Check affiliate links
        for (const { name, pattern } of AFFILIATE_PATTERNS) {
            if (pattern.test(desc)) {
                signals.push({ type: 'affiliate', value: name });
                affiliateNets.add(name);

                // Count brand-specific affiliate mentions
                brandMentions.set(name, (brandMentions.get(name) ?? 0) + 1);
            }
        }

        // 4. Extract promo codes
        let codeMatch;
        const codeRx = new RegExp(PROMO_CODE_REGEX.source, PROMO_CODE_REGEX.flags);
        while ((codeMatch = codeRx.exec(desc)) !== null) {
            const code = codeMatch[1].toUpperCase();
            // Filter out generic words that aren't actually promo codes
            if (!GENERIC_WORDS.has(code)) {
                promoCodes.add(code);
                signals.push({ type: 'promo_code', value: code });
            }
        }

        if (signals.length > 0) {
            sponsoredVideos.push({
                videoId: video.videoId,
                title: video.title,
                publishedAt: video.publishedAt instanceof Date
                    ? video.publishedAt.toISOString().split('T')[0]
                    : String(video.publishedAt),
                signals,
            });
        }
    }

    // Sort brands by frequency
    const detectedBrands = [...brandMentions.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([brand, count]) => ({ brand, mentionCount: count }));

    const sponsorshipRate = videos.length > 0
        ? Math.round((sponsoredVideos.length / videos.length) * 100)
        : 0;

    return {
        totalVideosScanned: videos.length,
        totalDetected: sponsoredVideos.length,
        sponsorshipRate,
        sponsorshipRateLabel: labelSponsorshipRate(sponsorshipRate),
        hasProperDisclosure: disclosureCount > 0,
        disclosureRate: sponsoredVideos.length > 0
            ? Math.round((disclosureCount / sponsoredVideos.length) * 100)
            : 100, // no sponsored = no disclosure needed
        detectedBrands,
        promoCodes: [...promoCodes],
        affiliateNetworks: [...affiliateNets],
        sponsoredVideos,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Words that match the promo code regex but aren't codes */
const GENERIC_WORDS = new Set([
    'THE', 'AND', 'FOR', 'USE', 'GET', 'OFF', 'OUT', 'NEW', 'NOW',
    'FREE', 'LINK', 'SAVE', 'BEST', 'DEAL', 'SALE', 'SHOW', 'CODE',
    'THIS', 'THAT', 'WITH', 'YOUR', 'FROM', 'HERE', 'BELOW', 'CHECK',
]);

function labelSponsorshipRate(rate) {
    if (rate >= 60) return 'Very High — majority of content is sponsored';
    if (rate >= 35) return 'High — frequent sponsored content';
    if (rate >= 15) return 'Moderate — regular but balanced';
    if (rate > 0)   return 'Low — occasional sponsored content';
    return 'None detected';
}

function emptyReport() {
    return {
        totalVideosScanned: 0,
        totalDetected: 0,
        sponsorshipRate: 0,
        sponsorshipRateLabel: 'None detected',
        hasProperDisclosure: true,
        disclosureRate: 100,
        detectedBrands: [],
        promoCodes: [],
        affiliateNetworks: [],
        sponsoredVideos: [],
    };
}
