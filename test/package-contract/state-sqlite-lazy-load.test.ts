// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("compiled state modules", () => {
  it("load node:sqlite only when a database is opened (#12741)", () => {
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        [
          "const loaded = () => process.moduleLoadList.includes('NativeModule sqlite');",
          "require('./dist/lib/state/sandbox.js');",
          "const before = loaded();",
          "const { withoutOpenClawSqliteMachineAuthority } = require('./dist/lib/state/snapshot/openclaw-sqlite-sanitizer.js');",
          "withoutOpenClawSqliteMachineAuthority(Buffer.from('SQLite format 3\\0', 'latin1'));",
          "process.stdout.write(JSON.stringify({ before, after: loaded() }));",
        ].join(""),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_OPTIONS: "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    expect(JSON.parse(output)).toEqual({ before: false, after: true });
  });
});
