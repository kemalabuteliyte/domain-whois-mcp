---
description: Quick domain availability check via RDAP with WHOIS fallback
argument-hint: <domain>
---

Check availability of `$ARGUMENTS` using the `domain_check` MCP tool from `domain-whois-mcp` with `method: "auto"`.

Report:
- Whether the domain is available
- If taken: registrar, expiration date, nameservers (from the same call or a follow-up `rdap_lookup` if details are sparse)
- If unclear: say so explicitly and offer to run `whois_raw`

Keep the reply short — one or two sentences plus a small table only if the user asked for details.
