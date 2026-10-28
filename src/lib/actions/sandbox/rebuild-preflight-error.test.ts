// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  printRebuildLockContention,
  printRebuildPreflightFailure,
} from "./rebuild-preflight-error";

describe("printRebuildPreflightFailure (#7794)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("outputs 'Aborting rebuild' and calls bail with the bail message", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildPreflightFailure("policy apply failed.", "Check network.", "policy error", bail);

    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join("\n");
    expect(output).toMatch(/Aborting rebuild/i);
    expect(output).toContain("sandbox is untouched, no data was lost.");
    expect(bail).toHaveBeenCalledWith("policy error");
  });

  it("includes the summary and detail in output", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildPreflightFailure("something broke.", "Try again.", "broke", bail);

    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join("\n");
    expect(output).toContain("something broke.");
    expect(output).toContain("Try again.");
  });

  it("preserves an explicit bail exit code", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildPreflightFailure(
      "policy restore is pending.",
      "Repair the pending transition.",
      "pending policy transition",
      bail,
      1,
    );

    expect(bail).toHaveBeenCalledWith("pending policy transition", 1);
  });
});

describe("printRebuildLockContention (#13808)", () => {
  it("frames lock contention as an untouched-sandbox preflight stop", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildLockContention("Recorded owner PID 4242 is still running.", bail);

    const output = errors.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Rebuild preflight failed:");
    expect(output).toContain("another onboarding or rebuild operation is in progress");
    expect(output).toContain("PID 4242");
    expect(output).toContain("Do not delete the lock manually.");
    expect(output).toContain("Aborting rebuild");
    expect(bail).toHaveBeenCalledWith("Another operation holds the rebuild lock.");
  });
});
