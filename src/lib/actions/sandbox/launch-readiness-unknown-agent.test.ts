// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";

import { entry } from "../../../../test/helpers/native-launch-readiness.ts";
import {
  describeUnknownLaunchAgent,
  publishLaunchReadiness,
  type LaunchReadinessDeps,
} from "./launch-readiness";

const AVAILABLE = ["openclaw", "hermes"];

describe("launch readiness unknown agent", () => {
  it("names an unknown registry agent when final validation fails", async () => {
    const deps: LaunchReadinessDeps = {
      getSandbox: () => entry("missing-launch-agent"),
      listAgents: () => AVAILABLE,
      withSandboxLock: async (_name, operation) => operation(),
      withGatewayLock: async (_name, operation) => operation(),
    };

    const result = await publishLaunchReadiness(
      { sandboxName: "alpha", gatewayName: "nemoclaw", gatewayPort: 8080, epochId: "a".repeat(64) },
      deps,
    );

    expect(result).toEqual({
      kind: "validation-failed",
      category: "config",
      unknownAgent: { name: "missing-launch-agent", available: AVAILABLE },
    });
  });

  it("escapes control characters in the agent name", () => {
    const message = describeUnknownLaunchAgent({
      name: "bad\u001b[2J\nagent",
      available: AVAILABLE,
    });

    expect(message).toBe(
      'the recorded launch agent "bad\\u001b[2J\\nagent" is not a known NemoClaw agent (available: openclaw, hermes)',
    );
    expect(message).not.toContain("\u001b");
  });
});
