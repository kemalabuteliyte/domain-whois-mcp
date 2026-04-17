---
description: Show WHOIS/RDAP infrastructure info for a TLD
argument-hint: <tld>
---

Report the registry infrastructure for the TLD `$ARGUMENTS`.

1. Call `tld_info` for `$ARGUMENTS` — get WHOIS server, RDAP base URL, IDN support, organization.
2. If WHOIS server is missing, call `find_whois_server` with a dummy domain on that TLD.
3. Summarize:
   - Registry organization
   - WHOIS server (or "none published")
   - RDAP base URL (or "not in IANA bootstrap")
   - IDN / DNSSEC support

Keep it to a compact block — the user is probably deciding whether the TLD is usable, not reading documentation.
