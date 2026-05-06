import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  tryNormalizePhone,
  formatPhoneDisplay,
  InvalidPhoneError,
} from "./phone";

describe("normalizePhone", () => {
  describe("valid inputs", () => {
    const cases: Array<[string, string]> = [
      ["22345678", "+21622345678"],
      ["022345678", "+21622345678"],
      ["21622345678", "+21622345678"],
      ["0021622345678", "+21622345678"],
      ["+21622345678", "+21622345678"],
      ["+216 22 345 678", "+21622345678"],
      ["(+216) 22-345-678", "+21622345678"],
      ["+216-22-345-678", "+21622345678"],
      ["  +216 22 345 678  ", "+21622345678"],
      ["20123456", "+21620123456"],
      ["30123456", "+21630123456"],
      ["40123456", "+21640123456"],
      ["50123456", "+21650123456"],
      ["70123456", "+21670123456"],
      ["90123456", "+21690123456"],
    ];

    for (const [input, expected] of cases) {
      it(`normalizes "${input}" → "${expected}"`, () => {
        expect(normalizePhone(input)).toBe(expected);
      });
    }
  });

  describe("invalid inputs", () => {
    const cases: Array<[unknown, string]> = [
      ["", "empty string"],
      ["   ", "whitespace only"],
      ["1234567", "too short (7 digits)"],
      ["123456789", "too long (9 digits)"],
      ["+33612345678", "foreign +33 prefix"],
      ["+1 555 123 4567", "foreign +1 prefix"],
      ["abcdefgh", "letters"],
      ["12abc678", "mixed letters and digits"],
      ["10123456", "invalid first digit (1)"],
      ["60123456", "invalid first digit (6)"],
      ["80123456", "invalid first digit (8)"],
      ["00123456", "invalid first digit (0)"],
    ];

    for (const [input, label] of cases) {
      it(`throws InvalidPhoneError for ${label}`, () => {
        expect(() => normalizePhone(input as string)).toThrow(InvalidPhoneError);
      });
    }
  });
});

describe("tryNormalizePhone", () => {
  it("returns the normalized phone on success", () => {
    expect(tryNormalizePhone("22345678")).toBe("+21622345678");
  });

  it("returns null on invalid input", () => {
    expect(tryNormalizePhone("invalid")).toBeNull();
    expect(tryNormalizePhone("")).toBeNull();
    expect(tryNormalizePhone("+33612345678")).toBeNull();
  });
});

describe("formatPhoneDisplay", () => {
  it("formats a valid E.164 Tunisian phone", () => {
    expect(formatPhoneDisplay("+21622345678")).toBe("+216 22 345 678");
    expect(formatPhoneDisplay("+21698765432")).toBe("+216 98 765 432");
  });

  it("returns input unchanged when not a Tunisian E.164 number", () => {
    expect(formatPhoneDisplay("+33612345678")).toBe("+33612345678");
    expect(formatPhoneDisplay("22345678")).toBe("22345678");
    expect(formatPhoneDisplay("")).toBe("");
  });
});
