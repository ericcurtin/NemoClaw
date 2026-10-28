// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { RD as _RD, R } from "../../cli/terminal-style";
import type { RebuildBail } from "./rebuild-credential-preflight";

export const REBUILD_VERIFY_SANDBOX_NAME_HINT = "Verify the sandbox name and rerun rebuild.";
export const REBUILD_PREFLIGHT_ABORT_LINE =
  "  Aborting rebuild — sandbox is untouched, no data was lost.";

export function rebuildSandboxNotRegisteredSummary(sandboxName: string): string {
  return `sandbox '${sandboxName}' not found in registry.`;
}

export function printRebuildPreflightHeader(summary: string): void {
  console.error("");
  console.error(`  ${_RD}Rebuild preflight failed:${R} ${summary}`);
}

export function printRebuildPreflightFailure(
  summary: string,
  detail: string,
  bailMessage: string,
  bail: RebuildBail,
  bailCode?: number,
): void {
  printRebuildPreflightHeader(summary);
  console.error(`  ${detail}`);
  console.error(REBUILD_PREFLIGHT_ABORT_LINE);
  if (bailCode === undefined) {
    bail(bailMessage);
  } else {
    bail(bailMessage, bailCode);
  }
}

export function printRebuildLockContention(lockMessage: string, bail: RebuildBail): void {
  printRebuildPreflightFailure(
    "another onboarding or rebuild operation is in progress.",
    `${lockMessage} Do not delete the lock manually.`,
    "Another operation holds the rebuild lock.",
    bail,
  );
}
