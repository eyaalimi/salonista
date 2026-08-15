import { describe, it, expect } from "vitest";
import { pickNextSlot, formatAvailability } from "./salon-availability";

// Reference fixe pour que les tests ne dependent pas de l'heure reelle.
const MAINTENANT = new Date(2026, 7, 15, 10, 0, 0, 0); // samedi 15 aout, 10h00

describe("pickNextSlot", () => {
  it("retient le creneau futur le plus proche", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 16, 0), capacity: 1, bookedCount: 0 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("ignore les creneaux passes", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 8, 0), capacity: 1, bookedCount: 0 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("ignore les creneaux complets", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 12, 0), capacity: 1, bookedCount: 1 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("accepte un creneau partiellement reserve", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 12, 0), capacity: 3, bookedCount: 2 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(12);
  });

  it("renvoie null quand aucun creneau ne convient", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 8, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)).toBeNull();
  });

  it("renvoie null sur une liste vide", () => {
    expect(pickNextSlot([], MAINTENANT)).toBeNull();
  });
});

describe("formatAvailability", () => {
  it("affiche l'heure seule quand c'est aujourd'hui", () => {
    const slot = new Date(2026, 7, 15, 14, 0);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre 14:00");
  });

  it("prefixe DEMAIN quand c'est le lendemain", () => {
    const slot = new Date(2026, 7, 16, 9, 0);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre demain 9:00");
  });

  it("affiche le jour de la semaine au-dela de demain", () => {
    // mardi 18 aout 2026
    const slot = new Date(2026, 7, 18, 11, 30);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre mardi 11:30");
  });

  it("complete les minutes sur deux chiffres", () => {
    const slot = new Date(2026, 7, 15, 9, 5);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre 9:05");
  });

  it("renvoie null pour un creneau absent", () => {
    expect(formatAvailability(null, MAINTENANT)).toBeNull();
  });
});
