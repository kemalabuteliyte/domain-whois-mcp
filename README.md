# domain-whois-mcp

An MCP (Model Context Protocol) server that provides comprehensive domain name intelligence via **native WHOIS** (RFC 3912) and **RDAP** (RFC 7482) protocols.

## Features

- **Native WHOIS Protocol** — Direct TCP connections to WHOIS servers on port 43. No third-party APIs.
- **RDAP Protocol** — Modern REST-based domain lookups with structured JSON responses.
- **IANA TLD Discovery** — Automatically discovers WHOIS/RDAP servers for any TLD by querying IANA. Works with gTLDs, new gTLDs, and ccTLDs.
- **Referral Following** — Follows WHOIS referrals from thin registries (e.g., Verisign) to thick registrar WHOIS for complete data.
- **Structured Parsing** — Parses free-text WHOIS responses into structured data (registrar, dates, nameservers, contacts, status).
- **Concurrent Bulk Checking** — Check up to 50 domains simultaneously with configurable parallelism.
- **Smart Server Selection** — Built-in database of 80+ known WHOIS servers, with IANA fallback for unknown TLDs.
- **TLD-Specific Handling** — Special query formats for registries that require them (DENIC, JPRS, Verisign, etc.).

## Installation

### Single Command (npx)

```bash
npx domain-whois-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "domain-whois": {
      "command": "npx",
      "args": ["-y", "domain-whois-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add domain-whois -- npx -y domain-whois-mcp
```

### From GitHub

```bash
# Clone and build
git clone https://github.com/YOUR_USERNAME/domain-whois-mcp.git
cd domain-whois-mcp
npm install && npm run build

# Add to Claude Code
claude mcp add domain-whois -- node /path/to/domain-whois-mcp/dist/index.js
```

### Global Install

```bash
npm install -g domain-whois-mcp
```

## Tools

### `whois_lookup`

Full WHOIS lookup with parsed structured data and raw response.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | required | Domain to look up |
| `server` | string | auto | Override WHOIS server |
| `follow_referrals` | boolean | true | Follow thin→thick referrals |
| `timeout` | number | 15000 | Timeout in ms |

**Example:**
```
whois_lookup({ domain: "google.com" })
```

### `rdap_lookup`

RDAP lookup returning structured JSON registration data.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | required | Domain to look up |
| `server` | string | auto | Override RDAP server URL |
| `timeout` | number | 15000 | Timeout in ms |

### `domain_check`

Check if a domain is available for registration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domain` | string | required | Domain to check |
| `method` | auto\|whois\|rdap\|both | auto | Lookup method |
| `timeout` | number | 15000 | Timeout in ms |

### `bulk_domain_check`

Check multiple domains concurrently.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domains` | string[] | required | Domains to check (max 50) |
| `concurrency` | number | 5 | Parallel lookups (1-10) |
| `method` | auto\|whois\|rdap | auto | Lookup method |
| `timeout` | number | 15000 | Per-domain timeout in ms |

**Example:**
```
bulk_domain_check({
  domains: ["cool-startup.com", "cool-startup.io", "cool-startup.dev"],
  concurrency: 3
})
```

### `tld_info`

Get TLD information from IANA including WHOIS/RDAP server assignments.

| Parameter | Type | Description |
|-----------|------|-------------|
| `tld` | string | TLD without leading dot (e.g., "com", "xyz") |

### `whois_raw`

Send a raw WHOIS query to any server. Useful for IP lookups, ASN queries, or debugging.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Query string |
| `server` | string | required | WHOIS server hostname |
| `port` | number | 43 | Server port |
| `timeout` | number | 15000 | Timeout in ms |

### `find_whois_server`

Discover WHOIS and RDAP servers for a domain or TLD.

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Domain or TLD to discover servers for |

### `rdap_bootstrap_info`

Show all TLDs that support RDAP from the IANA bootstrap file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | string | Optional substring filter |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  MCP Server                      │
│  (src/index.ts — 8 tools via stdio transport)    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ WHOIS Client│  │ RDAP Client │  │  IANA    │ │
│  │ (TCP:43)    │  │ (HTTPS)     │  │ Registry │ │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘ │
│         │                │              │        │
│  ┌──────┴──────┐         │         ┌────┴─────┐  │
│  │WHOIS Parser │         │         │Bootstrap │  │
│  │(text→struct)│         │         │(dns.json)│  │
│  └─────────────┘         │         └──────────┘  │
│                          │                       │
├──────────────────────────┼───────────────────────┤
│         Network Layer    │                       │
│  ┌───────────┐    ┌──────┴──────┐                │
│  │ TCP Socket│    │ HTTP Fetch  │                │
│  │ (net)     │    │ (built-in)  │                │
│  └───────────┘    └─────────────┘                │
└─────────────────────────────────────────────────┘
```

### How Server Discovery Works

1. **Built-in Database** — 80+ known WHOIS servers checked first (zero latency)
2. **IANA WHOIS** — Query `whois.iana.org` for any unknown TLD (TCP)
3. **IANA RDAP Bootstrap** — Fetch `data.iana.org/rdap/dns.json` for RDAP endpoints (HTTPS, cached 24h)
4. **Referral Following** — After initial WHOIS, follow referrals to registrar WHOIS for complete data

### How Availability Checking Works

The parser detects 15+ "not found" patterns across different registries:
- `No match for "DOMAIN.COM"`
- `NOT FOUND`
- `Status: free`
- `% Nothing found`
- etc.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run directly
node dist/index.js
```

## Protocol Details

### WHOIS (RFC 3912)

- Opens TCP connection to server port 43
- Sends: `<domain>\r\n`
- Reads response until server closes connection
- Special formats for some registries (DENIC: `-T dn,ace <domain>`, JPRS: `<domain>/e`)

### RDAP (RFC 7482/7483)

- HTTP GET to `<server>/domain/<name>`
- Accept: `application/rdap+json`
- Follows redirects
- Returns structured JSON with status, events, entities, nameservers

## License

MIT
