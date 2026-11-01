// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProcessBoundLockContentionError } from "../../state/registry/lock";
import {
  printRebuildLockContention,
  printRebuildPreflightFailure,
  printRebuildSandboxNotFound,
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

describe("printRebuildSandboxNotFound (#13808)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("names the missing sandbox and aborts rebuild", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildSandboxNotFound("ghost", bail);

    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join("\n");
    expect(output).toContain("Rebuild preflight failed: ");
    expect(output).toContain("sandbox 'ghost' not found in registry.");
    expect(output).toContain("Verify the sandbox name and rerun rebuild.");
    expect(output).toContain("Aborting rebuild");
    expect(bail).toHaveBeenCalledWith("Sandbox 'ghost' not found in registry.");
  });
});

describe("printRebuildLockContention (#13808)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("frames a held lock as a rebuild stop with the holder detail", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;
    const error = new ProcessBoundLockContentionError(
      "/lock",
      1,
      "Recorded owner PID 42 is running.",
    );

    printRebuildLockContention(error, bail);

    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .join("\n");
    expect(output).toContain("Rebuild preflight failed: ");
    expect(output).toContain("onboarding or rebuild run is already in progress.");
    expect(output).toContain("Recorded owner PID 42 is running.");
    expect(output).toContain("Aborting rebuild");
    expect(bail).toHaveBeenCalledOnce();
  });

  it("ignores other errors", () => {
    const bail = vi.fn() as unknown as (message: string, code?: number) => never;

    printRebuildLockContention(new Error("boom"), bail);

    expect(console.error).not.toHaveBeenCalled();
    expect(bail).not.toHaveBeenCalled();
  });
});
