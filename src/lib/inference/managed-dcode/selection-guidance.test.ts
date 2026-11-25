// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { CLI_NAME } from "../../cli/branding";
import { dcodeSelectionChangeGuidance } from "./selection-guidance";

describe("dcodeSelectionChangeGuidance", () => {
  it("keeps the placeholder without a target", () => {
    const guidance = dcodeSelectionChangeGuidance();
    expect(guidance).toContain(`--name <sandbox-name> --fresh --recreate-sandbox`);
    expect(guidance).toContain(`${CLI_NAME} use <sandbox-name>`);
  });

  it("names the target but not the unknown previous default", () => {
    const guidance = dcodeSelectionChangeGuidance("dcode-sb");
    expect(guidance).toContain(`--name dcode-sb --fresh --recreate-sandbox`);
    expect(guidance).toContain(`${CLI_NAME} dcode-sb inference get`);
    expect(guidance).toContain(`${CLI_NAME} use dcode-sb`);
    expect(guidance).toContain(`${CLI_NAME} use <previous-default-sandbox-name>`);
    expect(guidance).not.toContain("<sandbox-name>");
  });
});
