---
name: tld-advisor
description: Recommend the best TLD for a project based on audience, category, and brand fit. Use when the user asks "should I use .io or .dev", "best TLD for a SaaS / AI startup / dev tool", "is .xyz ok", or wants infrastructure info about a specific TLD. Uses tld_info and rdap_bootstrap_info to surface protocol support alongside opinionated guidance.
---

# TLD Advisor

Help the user pick the right TLD. Blends factual infrastructure data (from `tld_info` / `rdap_bootstrap_info`) with opinionated category guidance.

## When to Use

- "Should I register .io or .dev?"
- "Is .ai worth the premium?"
- "What TLDs are good for a SaaS product?"
- "Does .xyz look professional?"
- "What WHOIS server does .tr use?" (factual — route to `domain-lookup`)

## Category → TLD guidance (opinionated)

| Category | First choice | Fallback | Avoid |
|----------|-------------|----------|-------|
| Dev tool / CLI / library | `.dev` | `.io`, `.sh` | `.biz` |
| AI product | `.ai` | `.com`, `.app` | `.ml` (now retired) |
| Consumer SaaS | `.com` | `.co`, `.app` | `.click`, `.top` |
| API / infra | `.io` | `.dev`, `.cloud` | `.info` |
| Creative / portfolio | `.design`, `.studio`, `.me` | `.co` | — |
| Open source project | `.org`, `.dev` | `.io` | — |
| Gaming | `.gg`, `.games` | `.io` | — |
| Local business | ccTLD (`.de`, `.fr`, …) | `.com` | — |

`.com` is still the safest default. If unavailable, `.co` and `.app` read professionally; `.io` and `.dev` signal "technical" — not always what you want for consumer products.

## Workflow

1. If user names a TLD, call `tld_info` for that TLD. Report WHOIS server, RDAP server, IDN support.
2. If user is choosing between TLDs, produce the comparison table above with their category highlighted.
3. Call `rdap_bootstrap_info` if user asks about RDAP support specifically.

## Flags worth mentioning

- TLDs that don't publish public WHOIS (some ccTLDs) — harder to research owner info
- TLDs with high premium pricing (`.ai`, `.io`, `.dev` can be $60–$100/yr vs `.com` at ~$12)
- TLDs that have been flagged by some email providers as spam-adjacent (`.top`, `.click`, `.xyz` has improved but still mixed reputation)
- Retired TLDs — don't recommend anything that's been deprecated by its registry

Be specific. Don't hedge with "it depends" — the user asked you to recommend.
