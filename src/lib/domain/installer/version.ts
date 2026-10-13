// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const MIN_NODE_VERSION = "22.19.0";
export const MIN_NPM_MAJOR = 10;

export type RuntimeCheckResult =
  | { ok: true; nodeVersion: string; npmVersion: string }
  | { ok: false; reason: "invalid-node-version" | "invalid-npm-version" | "unsupported" };

const SEMVER_RE = /^[0-9]+(\.[0-9]+){0,2}$/;

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/, "");
}

export function versionMajor(version: string): number | null {
  const major = normalizeVersion(version).split(".")[0] ?? "";
  return /^[0-9]+$/.test(major) ? Number.parseInt(major, 10) : null;
}

export function versionGte(actual: string, minimum: string): boolean {
  const normalizedActual = normalizeVersion(actual);
  const normalizedMinimum = normalizeVersion(minimum);
  if (!SEMVER_RE.test(normalizedActual) || !SEMVER_RE.test(normalizedMinimum)) return false;

  const actualParts = normalizedActual.split(".").map((part) => Number.parseInt(part, 10));
  const minimumParts = normalizedMinimum.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (actualPart > minimumPart) return true;
    if (actualPart < minimumPart) return false;
  }
  return true;
}

/**
 * `getVersion()` can return SemVer metadata or git-describe output, which
 * `versionGte` rejects. Parse the complete public version format for this guard.
 */
const PUBLIC_VERSION =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
/** A git-describe suffix identifies commits after its base tag. */
const DESCRIBED_VERSION = /^(.*)-\d+-g[0-9a-f]{7,64}$/;

export interface ParsedPublicVersion {
  describedAfterTag: boolean;
  normalized: string;
  prerelease: readonly string[];
  release: readonly [number, number, number];
}

export function parsePublicVersion(version: string): ParsedPublicVersion | null {
  const normalized = normalizeVersion(version);
  const described = DESCRIBED_VERSION.exec(normalized);
  const match = PUBLIC_VERSION.exec(described?.[1] ?? normalized);
  if (!match) return null;
  const releaseParts = [match[1], match[2], match[3]] as const;
  if (releaseParts.some((part) => part.length > 1 && part.startsWith("0"))) return null;
  const prerelease = match[4] ? match[4].split(".") : [];
  if (
    prerelease.some(
      (identifier) =>
        /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0"),
    )
  ) {
    return null;
  }
  const release = releaseParts.map(Number) as [number, number, number];
  if (release.some((part) => !Number.isSafeInteger(part))) return null;
  return {
    describedAfterTag: described !== null,
    normalized,
    prerelease,
    release,
  };
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    const normalizedLeft = left.replace(/^0+(?=\d)/, "");
    const normalizedRight = right.replace(/^0+(?=\d)/, "");
    if (normalizedLeft.length !== normalizedRight.length) {
      return Math.sign(normalizedLeft.length - normalizedRight.length);
    }
    return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
  }
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareSemver(left: ParsedPublicVersion, right: ParsedPublicVersion): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = Math.sign(left.release[index] - right.release[index]);
    if (difference !== 0) return difference;
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  const shared = Math.min(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = comparePrereleaseIdentifier(left.prerelease[index], right.prerelease[index]);
    if (difference !== 0) return difference;
  }
  return Math.sign(left.prerelease.length - right.prerelease.length);
}

export function checkInstallerRuntime(input: {
  minNodeVersion?: string;
  minNpmMajor?: number;
  nodeVersion: string;
  npmVersion: string;
}): RuntimeCheckResult {
  const nodeVersion = input.nodeVersion.trim();
  const npmVersion = input.npmVersion.trim();
  const npmMajor = versionMajor(npmVersion);

  if (!SEMVER_RE.test(normalizeVersion(nodeVersion)))
    return { ok: false, reason: "invalid-node-version" };
  if (npmMajor === null) return { ok: false, reason: "invalid-npm-version" };

  if (
    !versionGte(nodeVersion, input.minNodeVersion ?? MIN_NODE_VERSION) ||
    npmMajor < (input.minNpmMajor ?? MIN_NPM_MAJOR)
  ) {
    return { ok: false, reason: "unsupported" };
  }

  return { ok: true, nodeVersion, npmVersion };
}
