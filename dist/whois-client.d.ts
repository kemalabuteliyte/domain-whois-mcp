/**
 * Native WHOIS Protocol Client
 *
 * Implements the WHOIS protocol (RFC 3912) using raw TCP sockets.
 * Features:
 * - Direct TCP connection to WHOIS servers on port 43
 * - Automatic WHOIS server discovery via IANA
 * - Referral following (thin -> thick WHOIS)
 * - TLD-specific query format handling
 * - Configurable timeouts
 */
import type { WhoisResult, WhoisQueryOptions } from './types.js';
/**
 * Perform a WHOIS lookup for a domain.
 * This is the main entry point for WHOIS queries.
 *
 * Strategy:
 * 1. Find the authoritative WHOIS server (built-in DB or IANA)
 * 2. Query the server
 * 3. Follow referrals to get thick WHOIS data
 * 4. Parse the response into structured data
 */
export declare function whoisLookup(domain: string, options?: WhoisQueryOptions): Promise<WhoisResult>;
/**
 * Perform a raw WHOIS query without parsing.
 * Useful when you need the raw text response.
 */
export declare function whoisRawQuery(domain: string, server: string, port?: number, timeout?: number): Promise<string>;
/**
 * Check if a domain is available via WHOIS.
 */
export declare function whoisCheck(domain: string, options?: WhoisQueryOptions): Promise<{
    available: boolean;
    result: WhoisResult;
}>;
//# sourceMappingURL=whois-client.d.ts.map