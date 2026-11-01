// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { RD as _RD, R } from "../../cli/terminal-style";
import { ProcessBoundLockContentionError } from "../../state/registry/lock";
import type { RebuildBail } from "./rebuild-credential-preflight";

export function printRebuildPreflightFailure(
  summary: string,
  detail: string,
  bailMessage: string,
  bail: RebuildBail,
  bailCode?: number,
): void {
  console.error("");
  console.error(`  ${_RD}Rebuild preflight failed:${R} ${summary}`);
  console.error(`  ${detail}`);
  console.error("  Aborting rebuild — sandbox is untouched, no data was lost.");
  if (bailCode === undefined) {
    bail(bailMessage);
  } else {
    bail(bailMessage, bailCode);
  }
}

/** Stop rebuild for a sandbox name the registry does not know. */
export function printRebuildSandboxNotFound(sandboxName: string, bail: RebuildBail): void {
  printRebuildPreflightFailure(
    `sandbox '${sandboxName}' not found in registry.`,
    "Verify the sandbox name and rerun rebuild.",
    `Sandbox '${sandboxName}' not found in registry.`,
    bail,
  );
}

/** Stop rebuild while another run holds a lifecycle lock. */
export function printRebuildLockBusy(remediation: string, bail: RebuildBail): void {
  printRebuildPreflightFailure(
    "another onboarding or rebuild run is already in progress.",
    remediation,
    "Could not acquire onboard lock before rebuild",
    bail,
  );
}

/** Frame a lock contention error as a rebuild stop. Other errors are ignored. */
export function printRebuildLockContention(error: unknown, bail: RebuildBail): void {
  if (!(error instanceof ProcessBoundLockContentionError)) return;
  printRebuildLockBusy(
    error.remediation ?? "Wait for the other run to finish, then rerun rebuild.",
    bail,
  );
}
