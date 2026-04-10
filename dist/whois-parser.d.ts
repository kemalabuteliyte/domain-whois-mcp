/**
 * WHOIS Response Parser
 *
 * Parses free-text WHOIS responses from various registries into structured data.
 * Handles multiple response formats: ICANN thin/thick, ccTLD-specific, new gTLDs.
 */
import type { WhoisResult } from './types.js';
/** Check if WHOIS response indicates domain is available */
export declare function isDomainAvailable(rawText: string): boolean;
/**
 * Parse a raw WHOIS response into a structured WhoisResult.
 */
export declare function parseWhoisResponse(rawText: string, domain: string, whoisServer: string): WhoisResult;
/**
 * Extract referral WHOIS server from response.
 * Many thin WHOIS servers (like Verisign) include a referral to the registrar's WHOIS.
 */
export declare function extractReferralServer(rawText: string): string | null;
//# sourceMappingURL=whois-parser.d.ts.map