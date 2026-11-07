/**
 * Citation grounding. The model may only cite handles it was given; anything
 * citing nothing (or only unknown handles) is removed before it is stored.
 * Pure and dependency-free so it can be unit tested.
 */
import type { EvidenceRef } from "./types";

type WithSources = { sources: string[] };
const LIMITS = { text: 400, short: 220, list: 6 };

const clipText = (s: string, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Normalize "[A1]", " a1 " → "A1" and keep only known handles (deduped). */
export function validSources(sources: string[] | undefined, known: Set<string>): string[] {
  const out: string[] = [];
  for (const raw of sources ?? []) {
    const h = String(raw).replace(/[\[\]\s]/g, "").toUpperCase();
    if (known.has(h) && !out.includes(h)) out.push(h);
  }
  return out;
}

/** Keep items that still cite at least one known handle; clip their text fields. */
export function groundList<T extends WithSources>(items: T[] | undefined, known: Set<string>, max = LIMITS.list): T[] {
  const out: T[] = [];
  for (const item of items ?? []) {
    const sources = validSources(item.sources, known);
    if (!sources.length) continue;
    const next: Record<string, unknown> = { ...item, sources };
    for (const [k, v] of Object.entries(next)) {
      if (typeof v === "string") next[k] = clipText(v, k === "text" || k === "risk" ? LIMITS.text : LIMITS.short * 2);
    }
    out.push(next as T);
    if (out.length >= max) break;
  }
  return out;
}

export function groundText(text: string | undefined, sources: string[] | undefined, known: Set<string>) {
  const s = validSources(sources, known);
  if (!s.length || !text?.trim()) return { text: null as string | null, sources: [] as string[] };
  return { text: clipText(text, 900), sources: s };
}

/** Replace handle strings with the evidence they point to (for rendering). */
export function resolveSources(handles: string[], map: Record<string, EvidenceRef>): EvidenceRef[] {
  return handles.map((h) => map[h]).filter(Boolean);
}

/** Recursively resolve every `sources` array in a stored payload. */
export function resolvePayload<T>(payload: T, map: Record<string, EvidenceRef>): unknown {
  if (Array.isArray(payload)) return payload.map((p) => resolvePayload(p, map));
  if (payload && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if ((k === "sources" || k.endsWith("Sources")) && Array.isArray(v)) out[k] = resolveSources(v as string[], map);
      else out[k] = resolvePayload(v, map);
    }
    return out;
  }
  return payload;
}
