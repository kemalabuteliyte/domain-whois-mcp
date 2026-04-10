/**
 * IANA TLD Registry Integration
 *
 * Discovers WHOIS and RDAP servers for any TLD by querying IANA directly.
 * - WHOIS server discovery via whois.iana.org (TCP port 43)
 * - RDAP endpoint discovery via IANA bootstrap file (HTTPS)
 * - In-process caching to avoid redundant lookups
 */
import * as net from 'node:net';
/** Built-in WHOIS server database for common TLDs (avoids IANA roundtrip) */
export const KNOWN_WHOIS_SERVERS = {
    // gTLDs
    com: 'whois.verisign-grs.com',
    net: 'whois.verisign-grs.com',
    org: 'whois.pir.org',
    info: 'whois.afilias.net',
    biz: 'whois.biz',
    xyz: 'whois.nic.xyz',
    app: 'whois.nic.google',
    dev: 'whois.nic.google',
    page: 'whois.nic.google',
    cloud: 'whois.nic.google',
    online: 'whois.nic.online',
    site: 'whois.nic.site',
    store: 'whois.nic.store',
    tech: 'whois.nic.tech',
    space: 'whois.nic.space',
    fun: 'whois.nic.fun',
    website: 'whois.nic.website',
    club: 'whois.nic.club',
    shop: 'whois.nic.shop',
    blog: 'whois.nic.blog',
    design: 'whois.nic.design',
    art: 'whois.nic.art',
    ai: 'whois.nic.ai',
    // ccTLDs
    io: 'whois.nic.io',
    co: 'whois.nic.co',
    me: 'whois.nic.me',
    tv: 'whois.nic.tv',
    cc: 'ccwhois.verisign-grs.com',
    eu: 'whois.eu',
    uk: 'whois.nic.uk',
    de: 'whois.denic.de',
    fr: 'whois.nic.fr',
    nl: 'whois.domain-registry.nl',
    ru: 'whois.tcinet.ru',
    su: 'whois.tcinet.ru',
    br: 'whois.registro.br',
    au: 'whois.auda.org.au',
    ca: 'whois.cira.ca',
    cn: 'whois.cnnic.cn',
    jp: 'whois.jprs.jp',
    kr: 'whois.kr',
    in: 'whois.registry.in',
    it: 'whois.nic.it',
    es: 'whois.nic.es',
    pl: 'whois.dns.pl',
    se: 'whois.iis.se',
    no: 'whois.norid.no',
    fi: 'whois.fi',
    dk: 'whois.dk-hostmaster.dk',
    at: 'whois.nic.at',
    ch: 'whois.nic.ch',
    be: 'whois.dns.be',
    cz: 'whois.nic.cz',
    pt: 'whois.dns.pt',
    ie: 'whois.weare.ie',
    nz: 'whois.srs.net.nz',
    za: 'whois.registry.net.za',
    mx: 'whois.mx',
    ar: 'whois.nic.ar',
    cl: 'whois.nic.cl',
    tr: 'whois.nic.tr',
    ua: 'whois.ua',
    ro: 'whois.rotld.ro',
    hu: 'whois.nic.hu',
    sk: 'whois.sk-nic.sk',
    si: 'whois.register.si',
    hr: 'whois.dns.hr',
    rs: 'whois.rnids.rs',
    bg: 'whois.register.bg',
    lt: 'whois.domreg.lt',
    lv: 'whois.nic.lv',
    ee: 'whois.tld.ee',
    is: 'whois.isnic.is',
    il: 'whois.isoc.org.il',
    sa: 'whois.nic.net.sa',
    ae: 'whois.aeda.net.ae',
    sg: 'whois.sgnic.sg',
    hk: 'whois.hkirc.hk',
    tw: 'whois.twnic.net.tw',
    th: 'whois.thnic.co.th',
    my: 'whois.mynic.my',
    id: 'whois.id',
};
/** Cache for IANA WHOIS server lookups */
const whoisServerCache = new Map();
/** Cache for RDAP bootstrap data: TLD -> RDAP base URL */
let rdapBootstrapCache = null;
let rdapBootstrapFetchedAt = 0;
const RDAP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
/**
 * Extract the effective TLD from a domain name.
 * Handles multi-level TLDs like co.uk, com.br, etc.
 */
export function extractTld(domain) {
    const parts = domain.toLowerCase().replace(/\.$/, '').split('.');
    if (parts.length < 2)
        return parts[0];
    return parts[parts.length - 1];
}
/**
 * Extract the second-level TLD for ccSLDs (e.g., co.uk -> co.uk)
 */
export function extractSecondLevelTld(domain) {
    const parts = domain.toLowerCase().replace(/\.$/, '').split('.');
    if (parts.length < 3)
        return null;
    const sld = parts.slice(-2).join('.');
    const ccSLDs = [
        'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
        'com.br', 'org.br', 'net.br',
        'com.au', 'net.au', 'org.au',
        'co.nz', 'net.nz', 'org.nz',
        'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
        'co.kr', 'or.kr',
        'co.in', 'net.in', 'org.in',
        'com.cn', 'net.cn', 'org.cn',
        'com.tw', 'org.tw', 'net.tw',
        'co.za', 'org.za', 'net.za',
        'com.mx', 'org.mx', 'net.mx',
        'com.ar', 'org.ar', 'net.ar',
        'com.tr', 'org.tr', 'net.tr',
        'co.il', 'org.il', 'net.il',
        'com.sg', 'org.sg', 'net.sg',
        'com.hk', 'org.hk', 'net.hk',
        'com.my', 'org.my', 'net.my',
        'co.id', 'or.id', 'web.id',
        'co.th', 'or.th', 'in.th',
    ];
    return ccSLDs.includes(sld) ? sld : null;
}
/**
 * Query whois.iana.org to discover the WHOIS server for a TLD.
 * This is the authoritative source for TLD WHOIS server assignments.
 */
export async function queryIanaWhoisServer(tld, timeout = 10000) {
    const normalizedTld = tld.toLowerCase().replace(/\.$/, '');
    // Check cache first
    if (whoisServerCache.has(normalizedTld)) {
        return {
            whoisServer: whoisServerCache.get(normalizedTld) ?? null,
            rawResponse: '(cached)',
        };
    }
    const rawResponse = await rawTcpQuery(normalizedTld, 'whois.iana.org', 43, timeout);
    const whoisMatch = rawResponse.match(/^whois:\s*(.+)/im);
    const whoisServer = whoisMatch ? whoisMatch[1].trim() : null;
    whoisServerCache.set(normalizedTld, whoisServer);
    return { whoisServer, rawResponse };
}
/**
 * Find the WHOIS server for a domain.
 * Strategy: known database -> IANA query -> null
 */
export async function findWhoisServer(domain, timeout = 10000) {
    const tld = extractTld(domain);
    // 1. Check built-in database
    if (KNOWN_WHOIS_SERVERS[tld]) {
        return KNOWN_WHOIS_SERVERS[tld];
    }
    // 2. Check cache
    if (whoisServerCache.has(tld)) {
        return whoisServerCache.get(tld) ?? null;
    }
    // 3. Query IANA
    const { whoisServer } = await queryIanaWhoisServer(tld, timeout);
    return whoisServer;
}
/**
 * Fetch and cache the IANA RDAP bootstrap file.
 * Returns a map of TLD -> RDAP base URL.
 */
export async function getRdapBootstrap() {
    const now = Date.now();
    if (rdapBootstrapCache && now - rdapBootstrapFetchedAt < RDAP_CACHE_TTL) {
        return rdapBootstrapCache;
    }
    const response = await fetch('https://data.iana.org/rdap/dns.json');
    if (!response.ok) {
        throw new Error(`Failed to fetch RDAP bootstrap: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json());
    const map = new Map();
    for (const [tlds, urls] of data.services) {
        const rdapUrl = urls[0]; // Use first URL
        if (!rdapUrl)
            continue;
        const baseUrl = rdapUrl.endsWith('/') ? rdapUrl : rdapUrl + '/';
        for (const tld of tlds) {
            map.set(tld.toLowerCase(), baseUrl);
        }
    }
    rdapBootstrapCache = map;
    rdapBootstrapFetchedAt = now;
    return map;
}
/**
 * Find the RDAP server for a domain's TLD.
 */
export async function findRdapServer(domain) {
    try {
        const bootstrap = await getRdapBootstrap();
        const tld = extractTld(domain);
        return bootstrap.get(tld) ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Get full TLD information from IANA including WHOIS and RDAP servers.
 */
export async function getTldInfo(tld) {
    const normalizedTld = tld.toLowerCase().replace(/\.$/, '');
    const [ianaResult, rdapServer] = await Promise.all([
        queryIanaWhoisServer(normalizedTld),
        findRdapServer(`example.${normalizedTld}`),
    ]);
    return {
        whoisServer: ianaResult.whoisServer,
        rdapServer,
        ianaResponse: ianaResult.rawResponse,
    };
}
/**
 * Low-level TCP query helper (used for WHOIS protocol).
 */
export function rawTcpQuery(query, server, port = 43, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const chunks = [];
        socket.setTimeout(timeout);
        socket.connect(port, server, () => {
            socket.write(query + '\r\n');
        });
        socket.on('data', (chunk) => {
            chunks.push(chunk);
        });
        socket.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf-8');
            resolve(data);
        });
        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error(`Connection to ${server}:${port} timed out after ${timeout}ms`));
        });
        socket.on('error', (err) => {
            reject(new Error(`WHOIS query to ${server}:${port} failed: ${err.message}`));
        });
    });
}
//# sourceMappingURL=iana.js.map