import { describe, it, expect } from "vitest";
import { FAQ_ITEMS, buildFaqJsonLd } from "./faq";

describe("FAQ_ITEMS", () => {
  it("contient au moins trois questions", () => {
    // Une FAQ d'une ou deux questions n'apporte rien au visiteur et fait
    // maigre dans les resultats enrichis.
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(3);
  });

  it("n'a ni question ni reponse vide", () => {
    for (const item of FAQ_ITEMS) {
      expect(item.question.trim().length).toBeGreaterThan(0);
      expect(item.answer.trim().length).toBeGreaterThan(0);
    }
  });

  it("n'a pas de question en double", () => {
    const questions = FAQ_ITEMS.map((i) => i.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe("buildFaqJsonLd", () => {
  it("produit un FAQPage", () => {
    const ld = buildFaqJsonLd();
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("FAQPage");
  });

  it("emet une entree Question par item affiche", () => {
    const ld = buildFaqJsonLd();
    expect((ld.mainEntity as unknown[]).length).toBe(FAQ_ITEMS.length);
  });

  it("reprend mot pour mot les questions et reponses affichees", () => {
    // C'est LA propriete qui compte : Google exige que le balisage
    // corresponde au contenu visible. Un ecart est une violation.
    const ld = buildFaqJsonLd();
    const entries = ld.mainEntity as Array<{
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }>;
    entries.forEach((entry, i) => {
      expect(entry["@type"]).toBe("Question");
      expect(entry.name).toBe(FAQ_ITEMS[i].question);
      expect(entry.acceptedAnswer["@type"]).toBe("Answer");
      expect(entry.acceptedAnswer.text).toBe(FAQ_ITEMS[i].answer);
    });
  });

  it("accepte une liste explicite", () => {
    const ld = buildFaqJsonLd([{ question: "Q ?", answer: "R." }]);
    expect(ld.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "Q ?",
        acceptedAnswer: { "@type": "Answer", text: "R." },
      },
    ]);
  });

  it("produit un mainEntity vide pour une liste vide", () => {
    expect(buildFaqJsonLd([]).mainEntity).toEqual([]);
  });
});
