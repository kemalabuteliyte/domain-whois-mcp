#!/usr/bin/env node
// PreToolUse hook for Bash. Reads the tool input on stdin, detects project-init
// commands (npm create / pnpm create / npx create-* / git init <dir>), extracts
// a probable project name, and prints a hint to stderr so Claude sees it in
// context. Always exits 0 — never blocks the Bash call.

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const cmd = payload?.tool_input?.command;
    if (typeof cmd !== "string") return;

    const patterns = [
      /\b(?:npm|pnpm|yarn|bun)\s+create\s+(?:[\w@/.-]+\s+)?([\w-]+)/i,
      /\bnpx\s+(?:-y\s+)?create-[\w-]+(?:@[\w.-]+)?\s+([\w-]+)/i,
      /\bgit\s+init\s+([\w./-]+)/i,
      /\bcargo\s+new\s+([\w-]+)/i,
      /\buv\s+init\s+([\w-]+)/i,
      /\bmkdir\s+(?:-p\s+)?([\w-]+)\s*&&\s*cd\s+\1/i,
    ];

    for (const re of patterns) {
      const m = cmd.match(re);
      if (m && m[1] && m[1] !== "." && m[1] !== ".." && m[1].length >= 3) {
        const name = m[1].replace(/^[./]+/, "").split("/").pop();
        if (!name) return;
        process.stderr.write(
          `Hint: project "${name}" — the domain-whois-mcp plugin can check domain availability. ` +
            `Run /check-domain ${name}.com or /find-name ${name} for a ranked shortlist.\n`
        );
        return;
      }
    }
  } catch {
    // Swallow all errors — the hook must never block the Bash call.
  }
});
