/**
 * IANA TLD Registry Integration
 *
 * Discovers WHOIS and RDAP servers for any TLD by querying IANA directly.
 * - WHOIS server discovery via whois.iana.org (TCP port 43)
 * - RDAP endpoint discovery via IANA bootstrap file (HTTPS)
 * - In-process caching to avoid redundant lookups
 */
/** Built-in WHOIS server database for common TLDs (avoids IANA roundtrip) */
export declare const KNOWN_WHOIS_SERVERS: Record<string, string>;
/**
 * Extract the effective TLD from a domain name.
 * Handles multi-level TLDs like co.uk, com.br, etc.
 */
export declare function extractTld(domain: string): string;
/**
 * Extract the second-level TLD for ccSLDs (e.g., co.uk -> co.uk)
 */
export declare function extractSecondLevelTld(domain: string): string | null;
/**
 * Query whois.iana.org to discover the WHOIS server for a TLD.
 * This is the authoritative source for TLD WHOIS server assignments.
 */
export declare function queryIanaWhoisServer(tld: string, timeout?: number): Promise<{
    whoisServer: string | null;
    rawResponse: string;
}>;
/**
 * Find the WHOIS server for a domain.
 * Strategy: known database -> IANA query -> null
 */
export declare function findWhoisServer(domain: string, timeout?: number): Promise<string | null>;
/**
 * Fetch and cache the IANA RDAP bootstrap file.
 * Returns a map of TLD -> RDAP base URL.
 */
export declare function getRdapBootstrap(): Promise<Map<string, string>>;
/**
 * Find the RDAP server for a domain's TLD.
 */
export declare function findRdapServer(domain: string): Promise<string | null>;
/**
 * Get full TLD information from IANA including WHOIS and RDAP servers.
 */
export declare function getTldInfo(tld: string): Promise<{
    whoisServer: string | null;
    rdapServer: string | null;
    ianaResponse: string;
}>;
/**
 * Low-level TCP query helper (used for WHOIS protocol).
 */
export declare function rawTcpQuery(query: string, server: string, port?: number, timeout?: number): Promise<string>;
//# sourceMappingURL=iana.d.ts.map