/**
 * WHOIS Response Parser
 *
 * Parses free-text WHOIS responses from various registries into structured data.
 * Handles multiple response formats: ICANN thin/thick, ccTLD-specific, new gTLDs.
 */
/** Patterns that indicate a domain is NOT found (available) */
const NOT_FOUND_PATTERNS = [
    /^no match/im,
    /^not found/im,
    /^no data found/im,
    /^nothing found/im,
    /^no entries found/im,
    /^status:\s*free/im,
    /^status:\s*available/im,
    /^domain not found/im,
    /^%+ no match/im,
    /^the queried object does not exist/im,
    /^this domain name has not been registered/im,
    /^no information available/im,
    /^object does not exist/im,
    /^domain\s+\S+\s+is\s+free/im,
    /^% nothing found/im,
    /^query_status:\s*220\s+available/im,
    /^No Object Found/im,
];
/** Check if WHOIS response indicates domain is available */
export function isDomainAvailable(rawText) {
    return NOT_FOUND_PATTERNS.some((p) => p.test(rawText.trim()));
}
/**
 * Parse a raw WHOIS response into a structured WhoisResult.
 */
export function parseWhoisResponse(rawText, domain, whoisServer) {
    const result = {
        domainName: domain,
        status: [],
        nameservers: [],
        rawText,
        whoisServer,
        queriedAt: new Date().toISOString(),
    };
    // Parse key-value pairs from the response
    const kvPairs = extractKeyValuePairs(rawText);
    // Domain name
    result.domainName =
        getFirst(kvPairs, ['Domain Name', 'domain', 'Domain', 'domain name']) ||
            domain;
    // Registry Domain ID
    result.registryDomainId = getFirst(kvPairs, [
        'Registry Domain ID',
        'Domain ID',
    ]);
    // Registrar
    result.registrar = getFirst(kvPairs, [
        'Registrar',
        'Sponsoring Registrar',
        'registrar',
        'Registrar Name',
    ]);
    result.registrarUrl = getFirst(kvPairs, [
        'Registrar URL',
        'Referral URL',
        'Registrar Homepage',
    ]);
    result.registrarWhoisServer = getFirst(kvPairs, [
        'Registrar WHOIS Server',
        'WHOIS Server',
        'Registrar Whois',
    ]);
    // Dates
    result.creationDate = normalizeDate(getFirst(kvPairs, [
        'Creation Date',
        'Created Date',
        'Created',
        'Created On',
        'Registration Date',
        'Registration Time',
        'registered',
        'Domain Registration Date',
        'Registered on',
        'Registered',
        'created',
        'create',
    ]));
    result.expirationDate = normalizeDate(getFirst(kvPairs, [
        'Registry Expiry Date',
        'Registrar Registration Expiration Date',
        'Expiration Date',
        'Expiry Date',
        'Expires On',
        'Expires',
        'Expiry date',
        'expire',
        'paid-till',
        'Domain Expiration Date',
        'Expiry',
    ]));
    result.updatedDate = normalizeDate(getFirst(kvPairs, [
        'Updated Date',
        'Last Updated',
        'Last Modified',
        'Modified',
        'Last updated',
        'changed',
        'Domain Last Updated Date',
        'Updated',
    ]));
    // Status
    const statusKeys = [
        'Domain Status',
        'Status',
        'status',
        'Domain status',
        'state',
    ];
    for (const key of statusKeys) {
        const values = kvPairs.get(key);
        if (values) {
            for (const v of values) {
                // Some statuses include URL explanations, keep the status code
                const statusCode = v.split(/\s+/)[0];
                if (statusCode && !result.status.includes(statusCode)) {
                    result.status.push(statusCode);
                }
            }
        }
    }
    // Nameservers
    const nsKeys = ['Name Server', 'Nameservers', 'nserver', 'Nameserver', 'NS', 'name server'];
    for (const key of nsKeys) {
        const values = kvPairs.get(key);
        if (values) {
            for (const v of values) {
                const ns = v.split(/\s+/)[0].toLowerCase();
                if (ns && !result.nameservers.includes(ns)) {
                    result.nameservers.push(ns);
                }
            }
        }
    }
    // DNSSEC
    result.dnssec = getFirst(kvPairs, ['DNSSEC', 'dnssec', 'Dnssec']);
    // Contacts
    result.registrant = parseContact(kvPairs, 'Registrant');
    result.admin = parseContact(kvPairs, 'Admin');
    result.tech = parseContact(kvPairs, 'Tech');
    return result;
}
/**
 * Extract referral WHOIS server from response.
 * Many thin WHOIS servers (like Verisign) include a referral to the registrar's WHOIS.
 */
export function extractReferralServer(rawText) {
    const patterns = [
        /Registrar WHOIS Server:\s*(.+)/i,
        /WHOIS Server:\s*(.+)/i,
        /Whois Server:\s*(.+)/i,
        /ReferralServer:\s*whois:\/\/(.+)/i,
        /refer:\s*(.+)/i,
    ];
    for (const pattern of patterns) {
        const match = rawText.match(pattern);
        if (match) {
            const server = match[1].trim();
            // Avoid self-referrals and invalid values
            if (server && !server.includes(' ') && server.includes('.')) {
                return server;
            }
        }
    }
    return null;
}
/**
 * Extract key-value pairs from WHOIS text response.
 * Handles multi-value keys (like multiple Name Server entries).
 */
function extractKeyValuePairs(text) {
    const pairs = new Map();
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines, comments, and legal text
        if (!trimmed ||
            trimmed.startsWith('%') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('>>>') ||
            trimmed.startsWith('---') ||
            trimmed.startsWith('NOTICE:') ||
            trimmed.startsWith('TERMS OF USE:') ||
            trimmed.startsWith('Copyright')) {
            continue;
        }
        // Match "Key: Value" or "Key:Value" patterns
        const kvMatch = trimmed.match(/^([^:]{1,50}):\s*(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim();
            const value = kvMatch[2].trim();
            if (value) {
                const existing = pairs.get(key) || [];
                existing.push(value);
                pairs.set(key, existing);
            }
        }
    }
    return pairs;
}
/** Get first matching value from a set of possible keys */
function getFirst(kvPairs, keys) {
    for (const key of keys) {
        const values = kvPairs.get(key);
        if (values && values[0]) {
            return values[0];
        }
    }
    return undefined;
}
/** Parse a contact section from WHOIS key-value pairs */
function parseContact(kvPairs, prefix) {
    const contact = {};
    contact.name = getFirst(kvPairs, [
        `${prefix} Name`,
        `${prefix} Contact Name`,
    ]);
    contact.organization = getFirst(kvPairs, [
        `${prefix} Organization`,
        `${prefix} Organisation`,
    ]);
    contact.street = getFirst(kvPairs, [
        `${prefix} Street`,
        `${prefix} Address`,
    ]);
    contact.city = getFirst(kvPairs, [`${prefix} City`]);
    contact.state = getFirst(kvPairs, [
        `${prefix} State/Province`,
        `${prefix} State`,
    ]);
    contact.postalCode = getFirst(kvPairs, [
        `${prefix} Postal Code`,
        `${prefix} Zip Code`,
    ]);
    contact.country = getFirst(kvPairs, [
        `${prefix} Country`,
        `${prefix} Country/Economy`,
    ]);
    contact.phone = getFirst(kvPairs, [
        `${prefix} Phone`,
        `${prefix} Phone Number`,
    ]);
    contact.fax = getFirst(kvPairs, [
        `${prefix} Fax`,
        `${prefix} Fax Number`,
    ]);
    contact.email = getFirst(kvPairs, [
        `${prefix} Email`,
        `${prefix} Contact Email`,
    ]);
    // Return undefined if no fields were populated
    const hasData = Object.values(contact).some((v) => v !== undefined);
    return hasData ? contact : undefined;
}
/** Attempt to normalize date string to ISO format */
function normalizeDate(dateStr) {
    if (!dateStr)
        return undefined;
    // Already ISO-ish
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr;
    }
    // Try to parse with Date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }
    // Return as-is if we can't parse
    return dateStr;
}
//# sourceMappingURL=whois-parser.js.map