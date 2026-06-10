import { describe, it, expect } from "vitest";
import { classifySession } from "./verify-authz";

describe("classifySession", () => {
  it("returns { kind: 'none' } when session is null", () => {
    expect(classifySession(null)).toEqual({ kind: "none" });
  });

  it("returns { kind: 'employee', … } when session.employee is present", () => {
    const session = {
      user: { id: "u1", role: "PROVIDER" },
      employee: {
        id: "emp1",
        providerId: "prov1",
        role: "CASHIER",
        displayName: "Amira",
        permissions: [],
      },
    } as never;
    expect(classifySession(session)).toEqual({
      kind: "employee",
      employeeId: "emp1",
      providerId: "prov1",
    });
  });

  it("employee path wins even if user.role is PROVIDER on the same JWT", () => {
    const session = {
      user: { id: "u1", role: "PROVIDER" },
      employee: {
        id: "emp1",
        providerId: "prov1",
        role: "CASHIER",
        displayName: "Amira",
        permissions: [],
      },
    } as never;
    const result = classifySession(session);
    expect(result.kind).toBe("employee");
  });

  it("returns { kind: 'admin' } when user.role is ADMIN", () => {
    const session = { user: { id: "u1", role: "ADMIN" }, employee: null } as never;
    expect(classifySession(session)).toEqual({ kind: "admin" });
  });

  it("returns { kind: 'owner-pending-lookup', userId } for PROVIDER role without employee", () => {
    const session = { user: { id: "u1", role: "PROVIDER" }, employee: null } as never;
    expect(classifySession(session)).toEqual({
      kind: "owner-pending-lookup",
      userId: "u1",
    });
  });

  it("returns { kind: 'none' } for PROVIDER role without user.id", () => {
    const session = { user: { role: "PROVIDER" }, employee: null } as never;
    expect(classifySession(session)).toEqual({ kind: "none" });
  });

  it("returns { kind: 'none' } for CLIENT role", () => {
    const session = { user: { id: "u1", role: "CLIENT" }, employee: null } as never;
    expect(classifySession(session)).toEqual({ kind: "none" });
  });

  it("returns { kind: 'none' } for INFLUENCER role", () => {
    const session = { user: { id: "u1", role: "INFLUENCER" }, employee: null } as never;
    expect(classifySession(session)).toEqual({ kind: "none" });
  });
});
