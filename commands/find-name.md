---
description: Brainstorm project names and bulk-check domain availability across TLDs
argument-hint: <concept or keyword>
---

The user wants a ranked shortlist of available domain names for: **$ARGUMENTS**

Run the `project-name-finder` skill workflow:

1. Brainstorm 15–30 candidate names inspired by "$ARGUMENTS" (short, pronounceable, no hyphens/numbers, no obvious trademark collisions).
2. Fan out across `.com .io .dev .ai .app .co` — build the list as `name.tld` pairs.
3. Call `bulk_domain_check` with `concurrency: 5`. Split into batches of 50 if the total exceeds that.
4. Rank by: `.com` availability (heaviest), short length, multi-TLD coverage, pronounceability.
5. Return the top 5 as a markdown table: Name | Available on | Notes.
6. Offer to pull WHOIS/RDAP on any interesting taken names.

Do not include any name in the shortlist that you didn't actually verify.
