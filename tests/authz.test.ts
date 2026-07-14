import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";

describe("authorization error taxonomy", () => {
  it("maps authorization to 403", () => {
    const err = new AppError("AUTHORIZATION", "denied");
    expect(err.status).toBe(403);
  });
});
