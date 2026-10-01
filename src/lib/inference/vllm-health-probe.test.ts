// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isLocalProviderProbeOutputHealthy, validateLocalProvider } from "./local";
import { isOpenAiModelList, waitForNimHealth } from "./nim";

const MODELS_ENDPOINT = "http://127.0.0.1:8000/v1/models";
const HTML_PAGE = "<html>dev server</html>";
const MODEL_LIST = '{"object":"list","data":[{"id":"m"}]}';

describe("vLLM and NIM health probes", () => {
  beforeEach(() => {
    vi.stubEnv("HOME", fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-vllm-probe-")));
    vi.stubEnv("DOCKER_CONTEXT", "default");
    vi.stubEnv("DOCKER_HOST", "");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts a model list and rejects other bodies", () => {
    expect(isOpenAiModelList(MODEL_LIST)).toBe(true);
    expect(isOpenAiModelList('{"data":[]}')).toBe(true);
  });

  it.each(["", HTML_PAGE, "[]", "null", '{"models":[]}', '{"data":{}}'])(
    "rejects %j as a model list",
    (body) => {
      expect(isOpenAiModelList(body)).toBe(false);
    },
  );

  it.each([HTML_PAGE, '{"status":"ok"}'])(
    "treats %j from a models endpoint as unhealthy",
    (body) => {
      expect(isLocalProviderProbeOutputHealthy(MODELS_ENDPOINT, body)).toBe(false);
    },
  );

  it("treats a model list from a models endpoint as healthy", () => {
    expect(isLocalProviderProbeOutputHealthy(MODELS_ENDPOINT, MODEL_LIST)).toBe(true);
  });

  it("reports vllm-local as not responding when the host serves an HTML page", () => {
    const result = validateLocalProvider("vllm-local", () => HTML_PAGE);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/nothing is responding/);
  });

  it("keeps waiting for NIM when the port serves an HTML page", () => {
    const inspectContainerState = vi.fn(() => "exited");
    const healthy = waitForNimHealth(9000, 60, {
      container: "nim-test",
      inspectContainerState,
      readContainerLogs: () => "",
      runCaptureImpl: () => HTML_PAGE,
    });
    expect(healthy).toBe(false);
    expect(inspectContainerState).toHaveBeenCalledTimes(1);
  });

  it("reports NIM healthy once the port serves a model list", () => {
    const healthy = waitForNimHealth(9000, 60, { runCaptureImpl: () => MODEL_LIST });
    expect(healthy).toBe(true);
  });
});
