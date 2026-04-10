---
name: domain-lookup
description: >
  Look up domain name registration information using WHOIS and RDAP protocols.
  Check domain availability, get registrar info, expiration dates, nameservers,
  and DNSSEC status. Supports bulk checking across multiple TLDs.
triggers:
  - domain lookup
  - whois
  - rdap
  - domain check
  - domain available
  - domain availability
  - domain registration
  - domain expiry
  - domain info
  - tld info
  - nameserver lookup
  - bulk domain check
  - check domains
---

# Domain Lookup Skill

Use the `domain-whois-mcp` tools to answer questions about domain names.

## When to Use

- User asks about domain registration info (registrar, dates, nameservers, status)
- User wants to check if a domain is available
- User wants to check multiple domains at once
- User asks about a TLD's WHOIS or RDAP servers
- User needs raw WHOIS data for debugging or IP/ASN queries
- User wants to know which protocol (WHOIS/RDAP) is available for a TLD

## Tool Selection Guide

| User Intent | Tool | Key Parameters |
|-------------|------|----------------|
| "Who owns example.com?" | `whois_lookup` | domain |
| "Is example.com available?" | `domain_check` | domain, method=auto |
| "Check these 10 domains" | `bulk_domain_check` | domains, concurrency |
| "RDAP info for example.com" | `rdap_lookup` | domain |
| "What WHOIS server handles .xyz?" | `tld_info` | tld |
| "Send raw WHOIS to specific server" | `whois_raw` | query, server |
| "Which TLDs support RDAP?" | `rdap_bootstrap_info` | filter (optional) |
| "Find WHOIS server for .tr" | `find_whois_server` | domain |

## Usage Patterns

### Quick availability check
Use `domain_check` with method `auto`. It tries RDAP first (faster), falls back to WHOIS.

### Bulk availability across TLDs
Use `bulk_domain_check` with a list of domain+TLD combinations:
```
bulk_domain_check({
  domains: ["brand.com", "brand.io", "brand.dev", "brand.ai", "brand.co"],
  concurrency: 5
})
```

### Full registration details
Use `whois_lookup` for WHOIS data or `rdap_lookup` for structured RDAP.
WHOIS gives raw text + parsed fields. RDAP gives native JSON.

### Unknown or exotic TLD
Use `tld_info` first to see if WHOIS/RDAP is available, then proceed with the appropriate tool.

## Response Interpretation

- **Status codes** like `clientTransferProhibited`, `serverDeleteProhibited` indicate registry locks
- **DNSSEC: signedDelegation** means the domain uses DNSSEC
- **Expiration dates** help identify domains that may become available soon
- **Referral following** means the tool automatically got thick WHOIS from the registrar

## Limitations

- Some ccTLDs don't have public WHOIS services (the tool will report this)
- WHOIS rate limits vary by server — bulk checks use configurable concurrency to avoid hitting limits
- Privacy/proxy services may mask registrant contact information
- RDAP is not available for all TLDs yet (check with `rdap_bootstrap_info`)
