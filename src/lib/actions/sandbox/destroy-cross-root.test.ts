// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDestroyHarness,
  resetDestroyModuleCache,
} from "../../../../test/helpers/destroy-flow-test-harness";

describe("destroySandbox cross-root registry authority", () => {
  let home: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-destroy-cross-root-"));
    vi.stubEnv("HOME", home);
    vi.spyOn(process, "exit").mockImplementation(((code?: number | string | null) => {
      throw new Error(`process.exit(${code ?? 0})`);
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetDestroyModuleCache();
    fs.rmSync(home, { force: true, recursive: true });
  });

  function writeGatewayRegistry(port: number, names: string[]): string {
    const registryDir = path.join(home, ".nemoclaw", "gateways", String(port));
    const registryFile = path.join(registryDir, "sandboxes.json");
    fs.mkdirSync(registryDir, { recursive: true });
    fs.writeFileSync(
      registryFile,
      JSON.stringify({
        defaultSandbox: names[0],
        defaultSelectionRevision: 1,
        sandboxes: Object.fromEntries(
          names.map((name) => [
            name,
            {
              name,
              agent: "openclaw",
              provider: "ollama-local",
              model: "nvidia/nemotron",
              gatewayName: `nemoclaw-${port}`,
              gatewayPort: port,
            },
          ]),
        ),
      }),
    );
    return registryFile;
  }

  it("removes the sandbox from its sibling gateway registry", async () => {
    const registryFile = writeGatewayRegistry(8245, ["alpha"]);
    const harness = createDestroyHarness();

    await expect(
      harness.destroySandbox("alpha", { yes: true, cleanupGateway: false }),
    ).resolves.toBeUndefined();

    expect(JSON.parse(fs.readFileSync(registryFile, "utf8"))).toMatchObject({
      defaultSandbox: null,
      defaultSelectionRevision: 2,
      sandboxes: {},
    });
    expect(harness.selectGatewaySpy).toHaveBeenCalledWith(
      "alpha",
      "nemoclaw-8245",
      expect.anything(),
      undefined,
    );
    expect(harness.removeSandboxSpy).not.toHaveBeenCalled();
  });

  it("preserves the gateway when another sibling-root sandbox remains", async () => {
    const registryFile = writeGatewayRegistry(8245, ["alpha", "beta"]);
    const harness = createDestroyHarness();

    await expect(
      harness.destroySandbox("alpha", { yes: true, cleanupGateway: true }),
    ).resolves.toBeUndefined();

    expect(JSON.parse(fs.readFileSync(registryFile, "utf8"))).toMatchObject({
      defaultSandbox: "beta",
      sandboxes: { beta: { name: "beta" } },
    });
    expect(harness.cleanupGatewaySpy).not.toHaveBeenCalled();
    expect(harness.removeSandboxSpy).not.toHaveBeenCalled();
  });

  it("cleans up the gateway when only another gateway still has a sandbox", async () => {
    writeGatewayRegistry(8245, ["alpha"]);
    writeGatewayRegistry(8246, ["beta"]);
    const harness = createDestroyHarness();

    await expect(
      harness.destroySandbox("alpha", { yes: true, cleanupGateway: true }),
    ).resolves.toBeUndefined();

    expect(harness.cleanupGatewaySpy).toHaveBeenCalledWith("nemoclaw-8245", expect.anything());
    expect(harness.removeSandboxSpy).not.toHaveBeenCalled();
  });
});
