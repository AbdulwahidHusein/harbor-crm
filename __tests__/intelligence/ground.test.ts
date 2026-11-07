import { groundList, groundText, resolvePayload, validSources } from "@/lib/intelligence/ground";

const known = new Set(["A1", "A2", "T1"]);

describe("citation grounding", () => {
  it("normalizes and filters handles", () => {
    expect(validSources(["[a1]", " T1 ", "Z9", "A1"], known)).toEqual(["A1", "T1"]);
  });

  it("drops items that cite nothing the model was given", () => {
    const out = groundList(
      [
        { text: "Requested a revised proposal", sources: ["A1"] },
        { text: "Invented meeting", sources: ["A99"] },
        { text: "No citation", sources: [] },
      ],
      known,
    );
    expect(out.map((o) => o.text)).toEqual(["Requested a revised proposal"]);
  });

  it("nulls an uncited summary", () => {
    expect(groundText("Summary", ["X1"], known)).toEqual({ text: null, sources: [] });
    expect(groundText("Summary", ["A2"], known).text).toBe("Summary");
  });

  it("caps list length", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `t${i}`, sources: ["A1"] }));
    expect(groundList(many, known, 3)).toHaveLength(3);
  });

  it("resolves handles to evidence for rendering", () => {
    const map = { A1: { type: "activity" as const, id: "id-1", label: "Call" } };
    const out = resolvePayload({ summary: "x", summarySources: ["A1"], items: [{ sources: ["A1", "B2"] }] }, map) as any;
    expect(out.summarySources).toEqual([map.A1]);
    expect(out.items[0].sources).toEqual([map.A1]);
  });
});
