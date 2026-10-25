import { describe, expect, it } from "vitest";

import { formatMessageTime } from "@/features/assistant/lib/format-message-time";

describe("assistant campus time", () => {
  it("renders the welcome timestamp identically in Docker and the browser", () => {
    expect(formatMessageTime("2026-09-26T18:00:00+06:00")).toBe("6:00 PM");
    expect(formatMessageTime("2026-09-26T12:00:00Z")).toBe("6:00 PM");
  });

  it("handles campus midnight and noon without locale-dependent text", () => {
    expect(formatMessageTime("2026-09-26T18:05:00Z")).toBe("12:05 AM");
    expect(formatMessageTime("2026-09-26T06:05:00Z")).toBe("12:05 PM");
  });

  it("does not render a misleading time for invalid timestamps", () => {
    expect(formatMessageTime("not-a-date")).toBe("");
  });
});
