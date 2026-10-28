// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import {
  createRebuildFlowHarness,
  installRebuildFlowTestHooks,
} from "../../../../test/helpers/rebuild-flow-generic-harness";
import { mcpLifecycleLock, registryLock } from "../../../../test/helpers/rebuild-flow-harness";

describe("rebuild lock contention (#13808)", () => {
  installRebuildFlowTestHooks({ acceptThirdPartySoftware: true });

  it("stops in the preflight shape when another operation holds the lock", async () => {
    const harness = createRebuildFlowHarness({ sandboxEntry: {} });
    vi.spyOn(mcpLifecycleLock, "withMcpLifecycleLock").mockRejectedValue(
      new registryLock.ProcessBoundLockContentionError(
        "/home/user/.nemoclaw-portable-host.lock",
        120,
        "Recorded owner PID 4242 is still running. Wait for it to finish.",
      ),
    );

    await expect(
      harness.rebuildSandbox("alpha", ["--yes"], { throwOnError: true }),
    ).rejects.toThrow("Another operation holds the rebuild lock.");

    const output = harness.errorSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Rebuild preflight failed:");
    expect(output).toContain("PID 4242");
    expect(output).toContain("Aborting rebuild");
    expect(harness.runOpenshellSpy).not.toHaveBeenCalledWith(
      expect.arrayContaining(["delete"]),
      expect.anything(),
    );
  });
});
