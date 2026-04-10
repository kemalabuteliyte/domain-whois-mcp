#!/usr/bin/env node

/**
 * domain-whois-mcp — MCP Server for Domain WHOIS & RDAP Lookups
 *
 * A Model Context Protocol server that provides domain name intelligence
 * via native WHOIS (RFC 3912) and RDAP (RFC 7482) protocols.
 *
 * Features:
 * - Native WHOIS over TCP (port 43)
 * - RDAP over HTTPS with IANA bootstrap
 * - Automatic WHOIS/RDAP server discovery via IANA
 * - WHOIS referral following (thin → thick)
 * - Structured response parsing
 * - Concurrent bulk domain checking
 * - TLD information lookup
 *
 * Install: npx domain-whois-mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { whoisLookup, whoisRawQuery } from './whois-client.js';
import { isDomainAvailable } from './whois-parser.js';
import { rdapLookup, rdapCheck } from './rdap-client.js';
import {
  findWhoisServer,
  findRdapServer,
  queryIanaWhoisServer,
  getRdapBootstrap,
  extractTld,
  KNOWN_WHOIS_SERVERS,
} from './iana.js';
import type { DomainCheckResult, BulkCheckResult } from './types.js';

const server = new McpServer({
  name: 'domain-whois-mcp',
  version: '1.0.0',
  description:
    'Domain name intelligence via native WHOIS and RDAP protocols with IANA TLD discovery',
});

// ─── Tool: whois_lookup ──────────────────────────────────────────────────────

server.tool(
  'whois_lookup',
  `Look up WHOIS information for a domain name using native WHOIS protocol (TCP port 43).
Automatically discovers the correct WHOIS server via IANA if not known.
Follows referrals from thin WHOIS to thick WHOIS for complete data.
Returns parsed structured data + raw WHOIS text.`,
  {
    domain: z
      .string()
      .describe('Domain name to look up (e.g., "example.com", "google.co.uk")'),
    server: z
      .string()
      .optional()
      .describe('Override WHOIS server (optional, auto-discovered if not set)'),
    follow_referrals: z
      .boolean()
      .default(true)
      .describe('Follow WHOIS referrals for complete data (default: true)'),
    timeout: z
      .number()
      .default(15000)
      .describe('Query timeout in milliseconds (default: 15000)'),
  },
  async ({ domain, server: serverOverride, follow_referrals, timeout }) => {
    try {
      const result = await whoisLookup(domain, {
        server: serverOverride,
        follow: follow_referrals,
        timeout,
      });

      const structured = {
        domain: result.domainName,
        registrar: result.registrar,
        registrarUrl: result.registrarUrl,
        creationDate: result.creationDate,
        expirationDate: result.expirationDate,
        updatedDate: result.updatedDate,
        status: result.status,
        nameservers: result.nameservers,
        dnssec: result.dnssec,
        registrant: result.registrant,
        admin: result.admin,
        tech: result.tech,
        whoisServer: result.whoisServer,
        queriedAt: result.queriedAt,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text:
              '## WHOIS Lookup Result\n\n' +
              '```json\n' +
              JSON.stringify(structured, null, 2) +
              '\n```\n\n' +
              '### Raw WHOIS Response\n\n' +
              '```\n' +
              result.rawText +
              '\n```',
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `WHOIS lookup failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: rdap_lookup ───────────────────────────────────────────────────────

server.tool(
  'rdap_lookup',
  `Look up RDAP (Registration Data Access Protocol) information for a domain.
RDAP is the modern successor to WHOIS, providing structured JSON responses.
Automatically discovers the RDAP server via IANA bootstrap.
Not all TLDs support RDAP — falls back with a clear error message.`,
  {
    domain: z
      .string()
      .describe('Domain name to look up (e.g., "example.com")'),
    server: z
      .string()
      .optional()
      .describe('Override RDAP server base URL (optional, auto-discovered)'),
    timeout: z
      .number()
      .default(15000)
      .describe('Query timeout in milliseconds (default: 15000)'),
  },
  async ({ domain, server: serverOverride, timeout }) => {
    try {
      const result = await rdapLookup(domain, {
        server: serverOverride,
        timeout,
      });

      const summary = {
        domain: result.ldhName,
        unicodeName: result.unicodeName,
        handle: result.handle,
        status: result.status,
        events: result.events,
        nameservers: result.nameservers,
        entities: result.entities.map((e) => ({
          handle: e.handle,
          roles: e.roles,
        })),
        secureDNS: result.secureDNS,
        port43: result.port43,
        rdapServer: result.rdapServer,
        queriedAt: result.queriedAt,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text:
              '## RDAP Lookup Result\n\n' +
              '```json\n' +
              JSON.stringify(summary, null, 2) +
              '\n```',
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `RDAP lookup failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: domain_check ──────────────────────────────────────────────────────

server.tool(
  'domain_check',
  `Check if a domain name is available for registration.
Tries RDAP first (faster, structured), falls back to WHOIS.
Returns availability status and full registration data if registered.`,
  {
    domain: z
      .string()
      .describe('Domain name to check (e.g., "mydomain.com")'),
    method: z
      .enum(['auto', 'whois', 'rdap', 'both'])
      .default('auto')
      .describe('Lookup method: auto (RDAP→WHOIS), whois, rdap, or both'),
    timeout: z
      .number()
      .default(15000)
      .describe('Query timeout in milliseconds (default: 15000)'),
  },
  async ({ domain, method, timeout }) => {
    try {
      const result = await checkDomain(domain, method, timeout);

      let text = `## Domain Check: ${result.domain}\n\n`;
      text += `**Available:** ${result.available === null ? 'Unknown' : result.available ? 'YES ✓' : 'NO ✗'}\n`;
      text += `**Method:** ${result.method}\n`;
      text += `**Checked:** ${result.checkedAt}\n`;

      if (result.error) {
        text += `**Error:** ${result.error}\n`;
      }

      if (result.whois && !isDomainAvailable(result.whois.rawText)) {
        text += '\n### Registration Info (WHOIS)\n\n';
        text += `- **Registrar:** ${result.whois.registrar || 'N/A'}\n`;
        text += `- **Created:** ${result.whois.creationDate || 'N/A'}\n`;
        text += `- **Expires:** ${result.whois.expirationDate || 'N/A'}\n`;
        text += `- **Nameservers:** ${result.whois.nameservers.join(', ') || 'N/A'}\n`;
        text += `- **Status:** ${result.whois.status.join(', ') || 'N/A'}\n`;
      }

      if (result.rdap && result.rdap.status.length > 0) {
        text += '\n### Registration Info (RDAP)\n\n';
        text += `- **Status:** ${result.rdap.status.join(', ')}\n`;
        const regEvent = result.rdap.events.find((e) => e.eventAction === 'registration');
        const expEvent = result.rdap.events.find((e) => e.eventAction === 'expiration');
        if (regEvent) text += `- **Registered:** ${regEvent.eventDate}\n`;
        if (expEvent) text += `- **Expires:** ${expEvent.eventDate}\n`;
        text += `- **Nameservers:** ${result.rdap.nameservers.join(', ') || 'N/A'}\n`;
      }

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Domain check failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: bulk_domain_check ─────────────────────────────────────────────────

server.tool(
  'bulk_domain_check',
  `Check multiple domains for availability concurrently.
Supports parallel processing with configurable concurrency.
Useful for finding available domains across multiple TLDs or name variations.`,
  {
    domains: z
      .array(z.string())
      .min(1)
      .max(50)
      .describe('Array of domain names to check (max 50)'),
    concurrency: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe('Number of concurrent lookups (1-10, default: 5)'),
    method: z
      .enum(['auto', 'whois', 'rdap'])
      .default('auto')
      .describe('Lookup method for all domains'),
    timeout: z
      .number()
      .default(15000)
      .describe('Per-domain timeout in milliseconds (default: 15000)'),
  },
  async ({ domains, concurrency, method, timeout }) => {
    const startTime = Date.now();

    const results: DomainCheckResult[] = [];
    const queue = [...domains];

    // Process domains with concurrency limit
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const domain = queue.shift();
        if (!domain) break;
        const result = await checkDomain(domain, method, timeout);
        results.push(result);
      }
    });

    await Promise.all(workers);

    // Sort results in original order
    const domainOrder = new Map(domains.map((d, i) => [d.toLowerCase(), i]));
    results.sort(
      (a, b) => (domainOrder.get(a.domain) ?? 0) - (domainOrder.get(b.domain) ?? 0),
    );

    const bulkResult: BulkCheckResult = {
      results,
      totalChecked: results.length,
      available: results.filter((r) => r.available === true).length,
      registered: results.filter((r) => r.available === false).length,
      unknown: results.filter((r) => r.available === null).length,
      errors: results.filter((r) => r.error).length,
      durationMs: Date.now() - startTime,
    };

    // Format output
    let text = `## Bulk Domain Check Results\n\n`;
    text += `**Total:** ${bulkResult.totalChecked} | `;
    text += `**Available:** ${bulkResult.available} | `;
    text += `**Registered:** ${bulkResult.registered} | `;
    text += `**Unknown:** ${bulkResult.unknown} | `;
    text += `**Errors:** ${bulkResult.errors}\n`;
    text += `**Duration:** ${bulkResult.durationMs}ms | `;
    text += `**Concurrency:** ${concurrency}\n\n`;

    text += '| Domain | Status | Registrar | Expires |\n';
    text += '|--------|--------|-----------|----------|\n';

    for (const r of bulkResult.results) {
      const status =
        r.available === true
          ? 'AVAILABLE'
          : r.available === false
            ? 'REGISTERED'
            : r.error
              ? 'ERROR'
              : 'UNKNOWN';
      const registrar = r.whois?.registrar || '-';
      const expires = r.whois?.expirationDate || r.rdap?.events.find((e) => e.eventAction === 'expiration')?.eventDate || '-';
      text += `| ${r.domain} | ${status} | ${registrar} | ${expires} |\n`;
    }

    return { content: [{ type: 'text' as const, text }] };
  },
);

// ─── Tool: tld_info ──────────────────────────────────────────────────────────

server.tool(
  'tld_info',
  `Get information about a TLD (Top-Level Domain) from IANA.
Returns the authoritative WHOIS server, RDAP server, and IANA registry data.
Works for gTLDs (.com, .org), new gTLDs (.app, .xyz), and ccTLDs (.uk, .de).`,
  {
    tld: z
      .string()
      .describe('TLD to look up (e.g., "com", "co.uk", "xyz"). Omit the leading dot.'),
  },
  async ({ tld }) => {
    try {
      const normalizedTld = tld.toLowerCase().replace(/^\./, '').replace(/\.$/, '');

      const [ianaResult, rdapServer] = await Promise.all([
        queryIanaWhoisServer(normalizedTld),
        findRdapServer(`example.${normalizedTld}`),
      ]);

      const knownWhois = KNOWN_WHOIS_SERVERS[normalizedTld];

      let text = `## TLD Information: .${normalizedTld}\n\n`;
      text += `**WHOIS Server:** ${ianaResult.whoisServer || 'Not available'}\n`;
      if (knownWhois && knownWhois !== ianaResult.whoisServer) {
        text += `**Known WHOIS Server:** ${knownWhois}\n`;
      }
      text += `**RDAP Server:** ${rdapServer || 'Not available'}\n`;
      text += `**Has WHOIS:** ${ianaResult.whoisServer ? 'Yes' : 'No'}\n`;
      text += `**Has RDAP:** ${rdapServer ? 'Yes' : 'No'}\n`;

      text += '\n### IANA Response\n\n```\n' + ianaResult.rawResponse + '\n```';

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `TLD info lookup failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: whois_raw ─────────────────────────────────────────────────────────

server.tool(
  'whois_raw',
  `Send a raw WHOIS query to a specific server and return the unprocessed response.
Useful for debugging, querying IP WHOIS (rwhois), or non-standard WHOIS servers.`,
  {
    query: z
      .string()
      .describe('Query string to send (domain, IP, ASN, etc.)'),
    server: z
      .string()
      .describe('WHOIS server hostname (e.g., "whois.verisign-grs.com")'),
    port: z.number().default(43).describe('WHOIS server port (default: 43)'),
    timeout: z
      .number()
      .default(15000)
      .describe('Query timeout in milliseconds (default: 15000)'),
  },
  async ({ query, server: whoisServer, port, timeout }) => {
    try {
      const rawText = await whoisRawQuery(query, whoisServer, port, timeout);
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `## Raw WHOIS Response from ${whoisServer}:${port}\n\n` +
              '```\n' +
              rawText +
              '\n```',
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Raw WHOIS query failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: find_whois_server ─────────────────────────────────────────────────

server.tool(
  'find_whois_server',
  `Discover the WHOIS and RDAP servers for a domain or TLD.
Checks the built-in database first, then queries IANA for unknown TLDs.
Returns both WHOIS and RDAP server information.`,
  {
    domain: z
      .string()
      .describe('Domain name or TLD to find servers for (e.g., "example.com" or "com")'),
  },
  async ({ domain }) => {
    try {
      const tld = extractTld(domain);

      const [whoisServer, rdapServer] = await Promise.all([
        findWhoisServer(domain),
        findRdapServer(domain),
      ]);

      const knownWhois = KNOWN_WHOIS_SERVERS[tld];

      let text = `## Server Discovery for "${domain}" (TLD: .${tld})\n\n`;
      text += `**WHOIS Server:** ${whoisServer || 'Not found'}\n`;
      text += `**RDAP Server:** ${rdapServer || 'Not found'}\n`;
      text += `**Source:** ${knownWhois ? 'Built-in database' : 'IANA discovery'}\n`;
      text += '\n### Recommended Protocol\n\n';

      if (rdapServer) {
        text += 'RDAP is available and recommended (structured JSON, modern protocol).\n';
      } else if (whoisServer) {
        text += 'Only WHOIS is available for this TLD.\n';
      } else {
        text += 'No public WHOIS or RDAP service found for this TLD.\n';
      }

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Server discovery failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool: rdap_bootstrap_info ───────────────────────────────────────────────

server.tool(
  'rdap_bootstrap_info',
  `Show the IANA RDAP bootstrap data — lists all TLDs that support RDAP and their service URLs.
Useful for understanding RDAP coverage across TLDs.`,
  {
    filter: z
      .string()
      .optional()
      .describe('Optional filter: only show TLDs matching this substring'),
  },
  async ({ filter }) => {
    try {
      const bootstrap = await getRdapBootstrap();

      let entries = Array.from(bootstrap.entries());
      if (filter) {
        const f = filter.toLowerCase();
        entries = entries.filter(([tld]) => tld.includes(f));
      }

      entries.sort(([a], [b]) => a.localeCompare(b));

      let text = `## RDAP Bootstrap Data\n\n`;
      text += `**Total TLDs with RDAP:** ${bootstrap.size}\n`;
      if (filter) {
        text += `**Filter:** "${filter}" (${entries.length} matches)\n`;
      }
      text += '\n| TLD | RDAP Server |\n|-----|-------------|\n';

      for (const [tld, url] of entries.slice(0, 200)) {
        text += `| .${tld} | ${url} |\n`;
      }

      if (entries.length > 200) {
        text += `\n*...and ${entries.length - 200} more. Use the filter parameter to narrow results.*\n`;
      }

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `RDAP bootstrap fetch failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check a single domain's availability using the specified method.
 */
async function checkDomain(
  domain: string,
  method: string,
  timeout: number,
): Promise<DomainCheckResult> {
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, '').trim();
  const result: DomainCheckResult = {
    domain: normalizedDomain,
    available: null,
    method: 'error',
    checkedAt: new Date().toISOString(),
  };

  // AUTO: try RDAP first, fall back to WHOIS
  if (method === 'auto') {
    // Try RDAP
    try {
      const rdapResult = await rdapCheck(normalizedDomain, { timeout });
      if (rdapResult.available !== null) {
        result.available = rdapResult.available;
        result.rdap = rdapResult.result ?? undefined;
        result.method = 'rdap';
        return result;
      }
    } catch {
      // RDAP not available for this TLD, try WHOIS
    }

    // Fall back to WHOIS
    try {
      const whoisResult = await whoisLookup(normalizedDomain, { timeout });
      result.available = isDomainAvailable(whoisResult.rawText);
      result.whois = whoisResult;
      result.method = 'whois';
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  // WHOIS only
  if (method === 'whois') {
    try {
      const whoisResult = await whoisLookup(normalizedDomain, { timeout });
      result.available = isDomainAvailable(whoisResult.rawText);
      result.whois = whoisResult;
      result.method = 'whois';
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  }

  // RDAP only
  if (method === 'rdap') {
    try {
      const rdapResult = await rdapCheck(normalizedDomain, { timeout });
      result.available = rdapResult.available;
      result.rdap = rdapResult.result ?? undefined;
      result.method = 'rdap';
      if (rdapResult.error) result.error = rdapResult.error;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  }

  // Both methods
  if (method === 'both') {
    const [whoisProm, rdapProm] = await Promise.allSettled([
      whoisLookup(normalizedDomain, { timeout }),
      rdapCheck(normalizedDomain, { timeout }),
    ]);

    if (whoisProm.status === 'fulfilled') {
      result.whois = whoisProm.value;
      result.available = isDomainAvailable(whoisProm.value.rawText);
    }
    if (rdapProm.status === 'fulfilled') {
      result.rdap = rdapProm.value.result ?? undefined;
      if (result.available === null) {
        result.available = rdapProm.value.available;
      }
    }
    result.method = 'both';

    if (whoisProm.status === 'rejected' && rdapProm.status === 'rejected') {
      result.error = `WHOIS: ${whoisProm.reason}; RDAP: ${rdapProm.reason}`;
    }
    return result;
  }

  return result;
}

// ─── Server Startup ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
