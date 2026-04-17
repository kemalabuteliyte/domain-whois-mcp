---
name: domain-monitor
description: Check domain expiration dates and flag domains that will drop or renew soon. Use when the user asks "when does X expire", "is Y expiring", "is this domain dropping soon", or wants to watch a domain they'd like to grab. Uses whois_lookup and rdap_lookup to extract expiration timestamps.
---

# Domain Monitor

Detect how soon a domain will expire and report whether it's a realistic acquisition target.

## When to Use

- User asks when a specific domain expires
- User wants to know if a domain is about to drop (potentially become available)
- User says "I want example.com, can I get it?"
- User is researching a competitor's domain portfolio

## Workflow

1. Call `rdap_lookup` first (structured dates). Fall back to `whois_lookup` if RDAP is unavailable for the TLD.
2. Extract the expiration date and status codes.
3. Classify:
   - **> 180 days**: not actionable — not worth watching yet
   - **90–180 days**: distant — note it
   - **30–90 days**: approaching — watch for renewal
   - **0–30 days**: imminent — may drop if unrenewed
   - **expired**: check status codes like `redemptionPeriod`, `pendingDelete` — there's a ~75-day grace window before the domain becomes generally registrable
4. Report: domain, expiration date, days-to-expiry, current registrar, status codes, realistic assessment.

## Status codes to highlight

- `clientTransferProhibited` / `serverTransferProhibited` — owner or registry locked transfers (normal for active domains)
- `redemptionPeriod` — expired but in grace; can still be redeemed by the old owner
- `pendingDelete` — final 5 days before drop
- `autoRenewPeriod` — auto-renewed; don't count on it dropping

## Realistic assessment rules

- High-value `.com` domains rarely drop — someone is usually watching.
- If the domain has DNSSEC set up, it's actively maintained — low drop probability.
- If nameservers point to a parking service, it's often owned by a domainer — will be sold, not dropped.

Be honest: most "expiring" domains get renewed at the last minute.
