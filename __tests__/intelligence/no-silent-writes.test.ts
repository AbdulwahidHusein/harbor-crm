// Intelligence must never modify CRM records on its own. The only write paths
// are explicit user actions in actions/intelligence/* (create task on
// confirmation, dismiss a briefing item). AI output lives in crm_AI_Insights.
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "../..");
const WRITE = /prismadb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b|\$executeRaw/g;
const AI_TABLES = new Set(["crm_AI_Insights", "crm_AI_Dismissals"]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("Intelligence write boundaries", () => {
  const libFiles = walk(path.join(ROOT, "lib/intelligence"));

  it.each(libFiles.map((f) => [path.relative(ROOT, f)]))("%s only writes to AI tables", (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const writes = Array.from(src.matchAll(WRITE)).map((m) => m[1] ?? "$executeRaw");
    expect(writes.filter((t) => !AI_TABLES.has(t))).toEqual([]);
  });

  it("command tools expose no direct write tool", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/intelligence/command/tools.ts"), "utf8");
    const names = Array.from(src.matchAll(/name: "([a-z_]+)"/g)).map((m) => m[1]);
    expect(names.filter((n) => /^(create|update|delete|set|assign)_/.test(n))).toEqual([]);
    expect(names).toContain("propose_follow_up_tasks");
  });
});
