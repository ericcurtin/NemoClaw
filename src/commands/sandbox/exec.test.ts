// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execSandboxMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../../lib/actions/sandbox/exec", () => ({
  execSandbox: execSandboxMock,
}));

import { log } from "../../lib/cli/logger";
import * as portableAgentLifecycle from "../../lib/onboard/experimental/portable-agent-lifecycle";
import SandboxExecCommand from "./exec";

const rootDir = process.cwd();

type ExecOptions = { workdir?: string; tty?: boolean; timeoutSeconds?: number; stdin?: boolean };

/** Assert the action call for sandbox "alpha"; options default to the no-flag case. */
function expectExecCall(command: string[], options: ExecOptions = {}): void {
  expect(execSandboxMock).toHaveBeenCalledWith("alpha", command, {
    workdir: undefined,
    tty: false,
    timeoutSeconds: undefined,
    stdin: undefined,
    ...options,
  });
}

describe("SandboxExecCommand oclif parse path", () => {
  beforeEach(() => {
    execSandboxMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards everything after -- as the inner command argv", async () => {
    await SandboxExecCommand.run(
      ["alpha", "--", "openclaw", "agent", "--agent", "main", "-m", "hi"],
      rootDir,
    );
    expectExecCall(["openclaw", "agent", "--agent", "main", "-m", "hi"]);
  });

  it("keeps a later -- inside the command after the leading --", async () => {
    await SandboxExecCommand.run(["alpha", "--", "echo", "hi", "--", "there"], rootDir);
    expectExecCall(["echo", "hi", "--", "there"]);
    execSandboxMock.mockReset();

    await SandboxExecCommand.run(
      ["alpha", "--workdir", "/sandbox", "--", "git", "log", "--", "notes.md"],
      rootDir,
    );
    expectExecCall(["git", "log", "--", "notes.md"], { workdir: "/sandbox" });
  });

  it.each([
    ["git log -- notes.md", ["git", "log", "--", "notes.md"]],
    ["echo -- touch /tmp/canary", ["echo", "--", "touch", "/tmp/canary"]],
  ])("rejects a command word before the first --: %s", async (_name, words) => {
    await expect(SandboxExecCommand.run(["alpha", ...words], rootDir)).rejects.toThrow(
      "Put -- before the command",
    );
    expect(execSandboxMock).not.toHaveBeenCalled();
  });

  it("still accepts a command without any --", async () => {
    await SandboxExecCommand.run(["alpha", "hostname"], rootDir);
    expectExecCall(["hostname"]);
  });

  it("rejects schema-5 inside the user-facing exec lifecycle fence (#9203)", async () => {
    vi.spyOn(portableAgentLifecycle, "assertHermesPortableCommandUnavailable").mockImplementation(
      () => {
        throw new Error("schema-5 rejected");
      },
    );

    await expect(SandboxExecCommand.run(["alpha", "--", "true"], rootDir)).rejects.toThrow(
      "schema-5 rejected",
    );

    expect(execSandboxMock).not.toHaveBeenCalled();
  });

  it("does not assign host meaning to logging flags after --", async () => {
    const configure = vi.spyOn(log, "configure").mockImplementation(() => undefined);

    await SandboxExecCommand.run(["alpha", "--", "agent-cli", "--debug", "--quiet"], rootDir);

    expectExecCall(["agent-cli", "--debug", "--quiet"]);
    expect(configure).toHaveBeenCalledWith({ debug: false, quiet: false });
    expect(configure).not.toHaveBeenCalledWith({ debug: true, quiet: false });
    expect(configure).not.toHaveBeenCalledWith({ debug: false, quiet: true });
  });

  it("preserves repeated flag/value pairs after -- in their original order", async () => {
    await SandboxExecCommand.run(
      [
        "alpha",
        "--",
        "env",
        "-u",
        "ALL_PROXY",
        "-u",
        "HTTPS_PROXY",
        "-u",
        "HTTP_PROXY",
        "-u",
        "all_proxy",
        "-u",
        "https_proxy",
        "-u",
        "http_proxy",
        "/opt/venv/bin/python3",
        "-I",
        "-c",
        "pass",
      ],
      rootDir,
    );
    expectExecCall([
      "env",
      "-u",
      "ALL_PROXY",
      "-u",
      "HTTPS_PROXY",
      "-u",
      "HTTP_PROXY",
      "-u",
      "all_proxy",
      "-u",
      "https_proxy",
      "-u",
      "http_proxy",
      "/opt/venv/bin/python3",
      "-I",
      "-c",
      "pass",
    ]);
  });

  it("parses --workdir before -- and keeps the inner command intact", async () => {
    await SandboxExecCommand.run(
      ["alpha", "--workdir", "/sandbox/workspace", "--", "ls", "-la"],
      rootDir,
    );
    expectExecCall(["ls", "-la"], { workdir: "/sandbox/workspace" });
  });

  it("forwards a multi-line heredoc command verbatim to the action", async () => {
    // The action dispatches this exact argument through OpenShell. Its
    // byte-preserving boundary is asserted directly in the action test.
    const heredoc = "cat <<EOF\nline1\nline2\nEOF";
    await SandboxExecCommand.run(["alpha", "--", "bash", "-lc", heredoc], rootDir);
    expectExecCall(["bash", "-lc", heredoc]);
  });

  it("forwards a semicolon-joined command unchanged", async () => {
    await SandboxExecCommand.run(["alpha", "--", "bash", "-lc", "echo line1; echo line2"], rootDir);
    expectExecCall(["bash", "-lc", "echo line1; echo line2"]);
  });

  it("preserves --workdir and forwards a single-line command unchanged", async () => {
    await SandboxExecCommand.run(
      ["alpha", "--workdir", "/sandbox", "--", "bash", "-lc", "echo line1; echo line2"],
      rootDir,
    );
    expectExecCall(["bash", "-lc", "echo line1; echo line2"], { workdir: "/sandbox" });
  });

  it("parses --tty / --no-tty and --timeout into typed options", async () => {
    await SandboxExecCommand.run(["alpha", "--tty", "--timeout", "30", "--", "hostname"], rootDir);
    expectExecCall(["hostname"], { tty: true, timeoutSeconds: 30 });
    execSandboxMock.mockReset();

    await SandboxExecCommand.run(["alpha", "--no-tty", "--", "hostname"], rootDir);
    expectExecCall(["hostname"]);
  });

  it("runs without a pseudo-terminal when no tty flag is present (#10753)", async () => {
    await SandboxExecCommand.run(["alpha", "--", "dpkg", "-l", "perl-base"], rootDir);
    expectExecCall(["dpkg", "-l", "perl-base"]);
  });

  it("parses --stdin as explicit stdin forwarding", async () => {
    await SandboxExecCommand.run(["alpha", "--stdin", "--", "cat"], rootDir);
    expectExecCall(["cat"], { stdin: true });
  });

  it("parses --no-stdin as explicit stdin closure", async () => {
    await SandboxExecCommand.run(["alpha", "--no-stdin", "--", "pwd"], rootDir);
    expectExecCall(["pwd"], { stdin: false });
  });

  it("leaves stdin mode unset for the production spawner to auto-detect", async () => {
    await SandboxExecCommand.run(["alpha", "--", "bash"], rootDir);
    expectExecCall(["bash"]);
  });
});
