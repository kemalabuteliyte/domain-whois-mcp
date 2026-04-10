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
import { findRdapServer, extractTld } from './iana.js';
/**
 * Perform an RDAP lookup for a domain.
 *
 * Strategy:
 * 1. Find the RDAP server via IANA bootstrap (or use provided server)
 * 2. Query the RDAP endpoint
 * 3. Parse the JSON response into structured data
 */
export async function rdapLookup(domain, options = {}) {
    const normalizedDomain = domain.toLowerCase().replace(/\.$/, '').trim();
    const timeout = options.timeout ?? 15000;
    // Find RDAP server
    let baseUrl = options.server ?? undefined;
    if (!baseUrl) {
        baseUrl = (await findRdapServer(normalizedDomain)) ?? undefined;
        if (!baseUrl) {
            throw new Error(`No RDAP server found for "${normalizedDomain}". ` +
                `TLD "${extractTld(normalizedDomain)}" may not support RDAP.`);
        }
    }
    // Ensure base URL ends with /
    if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
    }
    const url = `${baseUrl}domain/${encodeURIComponent(normalizedDomain)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/rdap+json, application/json',
            },
            signal: controller.signal,
            redirect: 'follow',
        });
        if (response.status === 404) {
            // Domain not found in RDAP - this means it's available
            return createNotFoundResult(normalizedDomain, baseUrl);
        }
        if (!response.ok) {
            throw new Error(`RDAP query failed: ${response.status} ${response.statusText}`);
        }
        const raw = await response.json();
        return parseRdapResponse(raw, normalizedDomain, baseUrl);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`RDAP query to ${baseUrl} timed out after ${timeout}ms`);
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Check if a domain is available via RDAP.
 * Returns null for availability if it can't be determined.
 */
export async function rdapCheck(domain, options = {}) {
    try {
        const result = await rdapLookup(domain, options);
        // If no status and no events, likely not found
        if (result.status.length === 0 && result.events.length === 0) {
            return { available: true, result };
        }
        return { available: false, result };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // 404 or "not found" typically means available
        if (message.includes('404') || message.toLowerCase().includes('not found')) {
            return { available: true, result: null };
        }
        // No RDAP server means we can't check
        if (message.includes('No RDAP server')) {
            return { available: null, result: null, error: message };
        }
        return { available: null, result: null, error: message };
    }
}
/**
 * Parse raw RDAP JSON response into structured RdapResult.
 */
function parseRdapResponse(raw, domain, rdapServer) {
    const result = {
        ldhName: raw.ldhName || domain,
        unicodeName: raw.unicodeName,
        handle: raw.handle,
        status: Array.isArray(raw.status) ? raw.status : [],
        events: [],
        nameservers: [],
        entities: [],
        links: [],
        port43: raw.port43,
        rdapServer,
        queriedAt: new Date().toISOString(),
        raw,
    };
    // Parse events
    if (Array.isArray(raw.events)) {
        result.events = raw.events.map((e) => ({
            eventAction: e.eventAction || 'unknown',
            eventDate: e.eventDate || '',
            eventActor: e.eventActor,
        }));
    }
    // Parse nameservers
    if (Array.isArray(raw.nameservers)) {
        result.nameservers = raw.nameservers.map((ns) => (ns.ldhName || ns.unicodeName || '').toLowerCase()).filter(Boolean);
    }
    // Parse entities (registrar, registrant, etc.)
    if (Array.isArray(raw.entities)) {
        result.entities = raw.entities.map(parseRdapEntity);
    }
    // Parse secureDNS
    if (raw.secureDNS) {
        result.secureDNS = {
            delegationSigned: !!raw.secureDNS.delegationSigned,
            dsData: raw.secureDNS.dsData,
        };
    }
    // Parse links
    if (Array.isArray(raw.links)) {
        result.links = raw.links.map((l) => ({
            value: l.value,
            rel: l.rel,
            href: l.href || '',
            type: l.type,
        }));
    }
    return result;
}
/** Parse an RDAP entity */
function parseRdapEntity(entity) {
    const parsed = {
        handle: entity.handle,
        roles: Array.isArray(entity.roles) ? entity.roles : [],
        vcardArray: entity.vcardArray,
        publicIds: entity.publicIds,
    };
    if (Array.isArray(entity.entities)) {
        parsed.entities = entity.entities.map(parseRdapEntity);
    }
    return parsed;
}
/** Create a not-found result for available domains */
function createNotFoundResult(domain, rdapServer) {
    return {
        ldhName: domain,
        status: [],
        events: [],
        nameservers: [],
        entities: [],
        links: [],
        rdapServer,
        queriedAt: new Date().toISOString(),
        raw: { errorCode: 404, title: 'Not Found' },
    };
}
//# sourceMappingURL=rdap-client.js.map