/**
 * RDAP (Registration Data Access Protocol) Client
 *
 * Implements RDAP lookups per RFC 7482/7483.
 * Features:
 * - Automatic RDAP server discovery via IANA bootstrap
 * - Structured JSON response parsing
 * - HTTP redirect following
 * - Fallback and error handling
 */
import type { RdapResult, RdapQueryOptions } from './types.js';
/**
 * Perform an RDAP lookup for a domain.
 *
 * Strategy:
 * 1. Find the RDAP server via IANA bootstrap (or use provided server)
 * 2. Query the RDAP endpoint
 * 3. Parse the JSON response into structured data
 */
export declare function rdapLookup(domain: string, options?: RdapQueryOptions): Promise<RdapResult>;
/**
 * Check if a domain is available via RDAP.
 * Returns null for availability if it can't be determined.
 */
export declare function rdapCheck(domain: string, options?: RdapQueryOptions): Promise<{
    available: boolean | null;
    result: RdapResult | null;
    error?: string;
}>;
//# sourceMappingURL=rdap-client.d.ts.map