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
import { findWhoisServer, rawTcpQuery, extractTld } from './iana.js';
import { parseWhoisResponse, extractReferralServer, isDomainAvailable } from './whois-parser.js';
/** Maximum referral depth to prevent loops */
const MAX_REFERRAL_DEPTH = 3;
/**
 * TLD-specific query format overrides.
 * Some registries require special query formats.
 */
const QUERY_FORMATS = {
    'whois.denic.de': (d) => `-T dn,ace ${d}`,
    'whois.jprs.jp': (d) => `${d}/e`,
    'whois.nic.ad.jp': (d) => `${d}/e`,
    'whois.verisign-grs.com': (d) => `domain ${d}`,
    'ccwhois.verisign-grs.com': (d) => `domain ${d}`,
};
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
export async function whoisLookup(domain, options = {}) {
    const normalizedDomain = domain.toLowerCase().replace(/\.$/, '').trim();
    const timeout = options.timeout ?? 15000;
    // Find WHOIS server
    let server = options.server ?? undefined;
    if (!server) {
        server = (await findWhoisServer(normalizedDomain, timeout)) ?? undefined;
        if (!server) {
            throw new Error(`No WHOIS server found for "${normalizedDomain}". ` +
                `TLD "${extractTld(normalizedDomain)}" may not have a public WHOIS service.`);
        }
    }
    // Query with referral following
    const result = await queryWithReferrals(normalizedDomain, server, options.port ?? 43, timeout, options.follow !== false, 0);
    return result;
}
/**
 * Perform a raw WHOIS query without parsing.
 * Useful when you need the raw text response.
 */
export async function whoisRawQuery(domain, server, port = 43, timeout = 15000) {
    const query = formatQuery(domain, server);
    return rawTcpQuery(query, server, port, timeout);
}
/**
 * Check if a domain is available via WHOIS.
 */
export async function whoisCheck(domain, options = {}) {
    const result = await whoisLookup(domain, options);
    const available = isDomainAvailable(result.rawText);
    return { available, result };
}
/**
 * Query WHOIS server and follow referrals.
 */
async function queryWithReferrals(domain, server, port, timeout, followReferrals, depth) {
    const query = formatQuery(domain, server);
    const rawText = await rawTcpQuery(query, server, port, timeout);
    // Check for referral
    if (followReferrals && depth < MAX_REFERRAL_DEPTH) {
        const referralServer = extractReferralServer(rawText);
        if (referralServer && referralServer.toLowerCase() !== server.toLowerCase()) {
            try {
                const referralResult = await queryWithReferrals(domain, referralServer, port, timeout, followReferrals, depth + 1);
                // If referral gave us more data, use it (but keep thin WHOIS in rawText)
                if (!isDomainAvailable(referralResult.rawText) &&
                    referralResult.rawText.length > rawText.length * 0.3) {
                    // Combine: referral result with original thin WHOIS appended
                    referralResult.rawText =
                        referralResult.rawText +
                            '\n\n--- Thin WHOIS from ' + server + ' ---\n\n' +
                            rawText;
                    return referralResult;
                }
            }
            catch {
                // Referral failed, use the original response
            }
        }
    }
    return parseWhoisResponse(rawText, domain, server);
}
/**
 * Format the WHOIS query string for a specific server.
 * Some servers require special query formats.
 */
function formatQuery(domain, server) {
    const serverLower = server.toLowerCase();
    const formatter = QUERY_FORMATS[serverLower];
    return formatter ? formatter(domain) : domain;
}
//# sourceMappingURL=whois-client.js.map