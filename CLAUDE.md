# domain-whois-mcp

MCP server for domain WHOIS/RDAP lookups. TypeScript, Node.js 18+.

## Build & Run

```bash
npm install && npm run build    # compile TS → dist/
node dist/index.js              # start MCP server (stdio)
npm run dev                     # watch mode
```

## Project Structure

- `src/index.ts` — MCP server entry point, all 8 tool definitions
- `src/whois-client.ts` — Native WHOIS TCP client with referral following
- `src/whois-parser.ts` — Parses WHOIS text into structured data + availability detection
- `src/rdap-client.ts` — RDAP HTTP client with IANA bootstrap
- `src/iana.ts` — IANA TLD registry: WHOIS server discovery, RDAP bootstrap, known servers DB
- `src/types.ts` — Shared TypeScript interfaces

## Key Design Decisions

- Zero external dependencies beyond MCP SDK and Zod (no WHOIS npm packages)
- WHOIS uses raw TCP sockets (`node:net`) for full protocol control
- RDAP uses built-in `fetch` (Node 18+)
- IANA RDAP bootstrap cached in-process for 24h
- WHOIS server cache persists for process lifetime
- Referral depth capped at 3 to prevent loops
- Bulk check uses worker-queue pattern with configurable concurrency (1-10)
