---
name: project-name-finder
description: Brainstorm project / product / startup names and check domain availability across TLDs, returning a ranked shortlist. Use when the user is starting a new project, launching a product, picking a brand name, or asks "find me a name" / "what should I call my X" / "I need a domain for Y". Uses bulk_domain_check to fan out across .com/.io/.dev/.ai/.app/.co and ranks by .com availability, length, and TLD coverage.
---

# Project Name Finder

Help the user find an **available** domain name for a new project. The value is the pairing of creative brainstorming + live bulk availability checks — names that sound great but are taken add no value.

## Workflow

### 1. Clarify (one question, not a form)

Ask exactly one short question if the concept isn't clear:
- *What does the project do, and who's it for?*

Skip if the user already gave you enough (e.g. "AI invoicing for freelancers").

### 2. Brainstorm candidates

Generate **15–30** candidate names. Heuristics:
- Short (≤ 10 chars preferred, absolute max 14)
- Pronounceable — read them aloud mentally
- No hyphens, no numbers, no digit-letter substitution (`0` for `o`)
- Avoid obvious trademark collisions (don't prefix/suffix "Google", "Apple", etc.)
- Mix styles: real words, portmanteaus, made-up, latin/greek roots, verbs
- Avoid over-used AI-era suffixes unless it really fits (`-ify`, `-ly`, `AI`, `GPT`)

### 3. Fan out across TLDs

Default TLD set: `.com .io .dev .ai .app .co`. Add `.so .xyz` if the user is open to alternative TLDs, or `.sh .fm .gg` for specific verticals.

Build the full list as `name.tld` pairs and call:

```
bulk_domain_check({
  domains: [ /* N candidates × M tlds */ ],
  concurrency: 5
})
```

If you have > 50 domain+TLD combinations, split into batches of 50.

### 4. Rank

Sort descending by this composite score:
1. `.com` available → +10
2. `.io` or `.dev` or `.ai` available → +3 each
3. Length bonus: 10 - name_length (floor 0)
4. Penalty: -5 if contains hyphen, -3 if ≥ 12 chars
5. Bonus: +2 if available on 3+ of the default TLDs

### 5. Return the shortlist

Give the user a table of the **top 5**:

| Name | Available on | Notes |
|------|--------------|-------|
| ... | .com, .io, .dev | short, made-up, easy to say |

Follow up with: "Want me to pull full WHOIS / RDAP for any of the taken ones to see if they're expiring soon?"

## Example call

User: *"I'm starting an AI invoicing SaaS for freelancers, help me find a name."*

Reasonable brainstorm: `billr`, `invoiceon`, `paxo`, `sendbill`, `freely`, `invio`, `billique`, `paidly`, `invoyce`, `billwise`, `ledg`, `tabr`, `invoicy`, `freepaid`, `billet`, `payflo`, `invo`, `cleared`, `tallyr`, `zendue`.

Fan out across 6 TLDs → 120 lookups → 4 concurrent batches.

## Things to avoid

- Don't return names you haven't checked — every name in the shortlist must have a live availability result.
- Don't recommend domains with privacy/parking indicators as "probably available" — if WHOIS is ambiguous, call it out.
- Don't pick the first `.com` available — length and pronounceability matter more than TLD completeness.
