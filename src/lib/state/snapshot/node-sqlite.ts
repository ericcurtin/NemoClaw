// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DatabaseSync } from "node:sqlite";

type DatabaseOptions = ConstructorParameters<typeof DatabaseSync>[1];

/**
 * Open a database, loading `node:sqlite` on first use. A top-level import makes
 * Node print its SQLite ExperimentalWarning for every command (#12741).
 */
export function openSqliteDatabase(databasePath: string, options?: DatabaseOptions): DatabaseSync {
  const sqlite: typeof import("node:sqlite") = require("node:sqlite");
  return new sqlite.DatabaseSync(databasePath, options);
}
