---
description: Full registration details for a domain via WHOIS + RDAP
argument-hint: <domain>
---

Get complete registration details for `$ARGUMENTS`.

1. Call `rdap_lookup` for structured data (status, dates, nameservers, DNSSEC, registrar handle).
2. Call `whois_lookup` for the raw + parsed WHOIS (often contains registrant contact info RDAP redacts).
3. Merge the two results and present:
   - Registrar (name + IANA ID)
   - Created / updated / expires dates
   - Status codes (translate the common ones: `clientTransferProhibited` = owner-locked, etc.)
   - Nameservers
   - DNSSEC status
   - Any registrant info available (expect most fields to be redacted due to GDPR)

Flag anything unusual: expiring within 90 days, in `redemptionPeriod`, missing nameservers, etc.
