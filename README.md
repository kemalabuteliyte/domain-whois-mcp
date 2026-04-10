# domain-whois-mcp

> Give your AI agent real-time domain intelligence. WHOIS, RDAP, availability checking, bulk lookups — all via native protocols, zero API keys.

An [MCP](https://modelcontextprotocol.io) server that lets Claude (and any MCP-compatible AI) look up domain registration data, check availability, and explore TLD infrastructure using the **native WHOIS** (RFC 3912) and **RDAP** (RFC 7482) protocols directly — no third-party APIs, no rate-limited web scrapers, no API keys.

---

## Install in One Click

### Claude Code (recommended)

Run this single command:

```bash
claude mcp add domain-whois -- npx -y github:kemalabuteliyte/domain-whois-mcp
```

Or in the **Claude Code UI**: Settings > MCP Servers > Add Custom Server, paste:

```
npx -y github:kemalabuteliyte/domain-whois-mcp
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "domain-whois": {
      "command": "npx",
      "args": ["-y", "github:kemalabuteliyte/domain-whois-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### npm (if published)

```bash
claude mcp add domain-whois -- npx -y domain-whois-mcp
```

---

## What It Does

This MCP server gives your AI agent **8 tools** for complete domain name intelligence:

| Tool | What it does |
|------|-------------|
| **`whois_lookup`** | Full WHOIS lookup via native TCP protocol. Returns parsed structured data (registrar, dates, nameservers, contacts) + raw text. Automatically follows referrals for complete data. |
| **`rdap_lookup`** | Modern RDAP lookup returning structured JSON. RDAP is the successor to WHOIS with better data quality. |
| **`domain_check`** | Check if a domain is available for registration. Tries RDAP first (faster), falls back to WHOIS. |
| **`bulk_domain_check`** | Check up to 50 domains at once with configurable parallelism (1-10 concurrent). Perfect for finding available names across TLDs. |
| **`tld_info`** | Get information about any TLD from IANA — which WHOIS/RDAP servers handle it, registry details. |
| **`whois_raw`** | Send raw WHOIS queries to any server. Works for IP addresses, ASN lookups, and debugging. |
| **`find_whois_server`** | Discover which WHOIS and RDAP servers handle a domain or TLD. |
| **`rdap_bootstrap_info`** | Browse the IANA RDAP bootstrap — see which TLDs support RDAP and their endpoints. |

### How It Works Under the Hood

```
You ask Claude: "Is cool-startup.com available?"
                          │
                    ┌─────▼──────┐
                    │  MCP Server │
                    └─────┬──────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌─────────┐
        │  WHOIS   │ │  RDAP  │ │  IANA   │
        │  TCP:43  │ │ HTTPS  │ │Registry │
        └────┬─────┘ └───┬────┘ └────┬────┘
             │           │           │
     Raw socket to  HTTP GET to   Discovers
     whois server   rdap server   servers for
     on port 43     with JSON     unknown TLDs
             │           │           │
             ▼           ▼           ▼
        ┌──────────────────────────────┐
        │  Parsed, structured result   │
        │  back to Claude              │
        └──────────────────────────────┘
```

1. **Built-in DB** of 80+ known WHOIS servers is checked first (zero latency)
2. **IANA discovery** kicks in for unknown TLDs — queries `whois.iana.org` via TCP
3. **RDAP bootstrap** fetched from IANA and cached 24h for modern protocol lookups
4. **Referral following** — thin WHOIS (Verisign) automatically follows to thick registrar WHOIS
5. **Smart parsing** — 15+ "not found" patterns recognized across registries worldwide

---

## Why It's Useful

### For developers and startups
- **Find available domains** — "Check if these 20 brand name variations are available across .com, .io, .dev, .ai"
- **Due diligence** — "When does competitor.com expire? Who's their registrar?"
- **DNS debugging** — "What nameservers does our domain point to? Is DNSSEC enabled?"

### For domain investors
- **Bulk availability scanning** — Check 50 domains in one shot with concurrent lookups
- **Expiry monitoring** — Find expiration dates for domains you're watching
- **TLD research** — Explore which TLDs support RDAP, find WHOIS servers for exotic ccTLDs

### For security researchers
- **OSINT** — Look up registration details, registrar info, domain status flags
- **Infrastructure mapping** — Raw WHOIS queries for IP blocks, ASN lookups
- **Abuse investigation** — Check domain registration patterns and history

### For AI coding agents
- **Domain validation** — Agents building web apps can verify domain configuration
- **Automated checks** — CI/CD pipelines can verify domain status before deployments
- **Research automation** — Agents doing competitive analysis can pull domain intel

---

## Usage Examples with Claude

Once installed, just talk to Claude naturally:

**Check availability:**
> "Is my-cool-app.com available? Also check .io and .dev"

**Get WHOIS info:**
> "Look up the WHOIS for github.com — who's the registrar and when does it expire?"

**Bulk check:**
> "I'm naming my startup 'Nexora'. Check nexora.com, nexora.io, nexora.dev, nexora.ai, nexora.co, getnexora.com, nexorahq.com"

**TLD research:**
> "Which WHOIS server handles .tr domains? Does .ai support RDAP?"

**Raw queries:**
> "Send a raw WHOIS query for 8.8.8.8 to whois.arin.net"

**RDAP lookup:**
> "Get the RDAP data for cloudflare.com"

---

## AI Coding Agent Integration

This MCP is designed to be used by **autonomous coding agents** (Claude Code, Cursor, Windsurf, or any MCP-compatible agent). Here's how agents can leverage it:

### Agent Workflow: New Project Setup

```
Agent task: "Set up the domain and hosting for our new SaaS product"

1. Agent uses bulk_domain_check to find available domains
2. Agent uses whois_lookup to verify the chosen domain's status
3. Agent uses tld_info to check which protocols the TLD supports
4. Agent proceeds with DNS configuration knowing the domain landscape
```

### Agent Workflow: Competitive Research

```
Agent task: "Research our top 5 competitors' web infrastructure"

1. Agent uses whois_lookup on each competitor domain
2. Extracts registrar, nameservers, creation dates
3. Uses rdap_lookup for structured data where available
4. Compiles infrastructure comparison report
```

### Agent Workflow: Domain Portfolio Audit

```
Agent task: "Audit all our company domains and flag any expiring within 90 days"

1. Agent uses bulk_domain_check with all company domains
2. Parses expiration dates from results
3. Flags domains expiring soon
4. Generates renewal priority list
```

### Programmatic Tool Usage (for agent developers)

Each tool accepts structured JSON parameters:

```json
// whois_lookup
{ "domain": "example.com", "follow_referrals": true, "timeout": 15000 }

// bulk_domain_check
{ "domains": ["a.com", "b.io", "c.dev"], "concurrency": 5, "method": "auto" }

// whois_raw (for IP/ASN lookups)
{ "query": "AS13335", "server": "whois.radb.net" }
```

---

## Tool Reference

### `whois_lookup`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | *required* | Domain to look up (e.g., `example.com`) |
| `server` | string | auto | Override WHOIS server |
| `follow_referrals` | boolean | `true` | Follow thin WHOIS referrals |
| `timeout` | number | `15000` | Timeout in ms |

### `rdap_lookup`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | *required* | Domain to look up |
| `server` | string | auto | Override RDAP server URL |
| `timeout` | number | `15000` | Timeout in ms |

### `domain_check`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | *required* | Domain to check |
| `method` | `auto` \| `whois` \| `rdap` \| `both` | `auto` | Lookup method |
| `timeout` | number | `15000` | Timeout in ms |

### `bulk_domain_check`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domains` | string[] | *required* | Domains to check (max 50) |
| `concurrency` | number | `5` | Parallel lookups (1-10) |
| `method` | `auto` \| `whois` \| `rdap` | `auto` | Lookup method |
| `timeout` | number | `15000` | Per-domain timeout |

### `tld_info`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tld` | string | TLD without dot (e.g., `com`, `xyz`, `co.uk`) |

### `whois_raw`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Query string (domain, IP, ASN) |
| `server` | string | *required* | WHOIS server hostname |
| `port` | number | `43` | Server port |
| `timeout` | number | `15000` | Timeout in ms |

### `find_whois_server`

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Domain or TLD to find servers for |

### `rdap_bootstrap_info`

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | string | Optional: filter TLDs by substring |

---

## Architecture

```
src/
├── index.ts           # MCP server — 8 tools, stdio transport
├── whois-client.ts    # Native WHOIS TCP client (RFC 3912)
│                      # Referral following, TLD-specific query formats
├── whois-parser.ts    # Parses WHOIS text → structured data
│                      # 15+ not-found patterns, contact extraction
├── rdap-client.ts     # RDAP HTTP client (RFC 7482/7483)
│                      # IANA bootstrap, JSON response parsing
├── iana.ts            # IANA TLD registry integration
│                      # 80+ built-in servers, dynamic discovery, caching
└── types.ts           # TypeScript interfaces
```

**Zero external dependencies** beyond the MCP SDK and Zod. WHOIS uses Node.js `net` module for raw TCP. RDAP uses built-in `fetch`. No WHOIS npm packages, no API wrappers.

---

## Development

```bash
git clone https://github.com/kemalabuteliyte/domain-whois-mcp.git
cd domain-whois-mcp
npm install
npm run build     # compile TypeScript → dist/
npm run dev       # watch mode
node dist/index.js  # run directly
```

## Protocol Details

**WHOIS (RFC 3912):** Opens TCP to port 43, sends `domain\r\n`, reads until close. Handles TLD-specific formats (DENIC: `-T dn,ace`, JPRS: `/e` suffix, Verisign: `domain` prefix).

**RDAP (RFC 7482/7483):** HTTP GET to `{server}/domain/{name}` with `Accept: application/rdap+json`. Follows redirects. Returns structured JSON.

## License

MIT
