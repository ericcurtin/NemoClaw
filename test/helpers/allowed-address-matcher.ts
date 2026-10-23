// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { BlockList, isIP } from "node:net";

import { expect } from "vitest";

/** Build an address check from `allowed_ips` CIDR entries. */
export function allowedAddressMatcher(cidrs: readonly string[]): (address: string) => boolean {
  const allowed = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefixText] = cidr.split("/");
    const family = isIP(address ?? "");
    const prefix = Number(prefixText);
    expect(family, cidr).not.toBe(0);
    expect(Number.isInteger(prefix), cidr).toBe(true);
    allowed.addSubnet(address!, prefix, family === 4 ? "ipv4" : "ipv6");
  }
  return (address: string): boolean => {
    const family = isIP(address);
    return family !== 0 && allowed.check(address, family === 4 ? "ipv4" : "ipv6");
  };
}
