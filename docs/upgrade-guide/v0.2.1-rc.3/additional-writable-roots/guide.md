---
kind: upgrade-guide
description: "Sandbox policies carry required additional writable roots, which change the Windows ACL options and runner argv, the SSH helper protocol, and the Session log."
---

# Pass additional writable roots through sandbox policies

English | [中文](guide.zh.md)

## Change

A session may now write under additional directories besides its main root while its mode is `workspace-write`. The new field reaches every surface that carries a sandbox policy:

- `SandboxExecutionPolicy` from `@deepseek-ai/dsh-sandbox`, and therefore `SandboxPolicy`, has a required `additionalRoots: readonly string[]`. Code that builds a policy literal no longer compiles without it.
- The Windows ACL backend grants explicit `additionalWritableRoots` as well, each with its own capability SID, instead of refusing them with `SANDBOX_UNSUPPORTED_POLICY`.
- `AclSandboxOptions` from `@deepseek-ai/dsh-sandbox-windows-acl` replaces `writableDirs` and `writeSid` with `writable: readonly { dir, writeSid }[]`, one entry and one capability SID per root.
- The Windows ACL runner accepts `--workspace` and `--write-sid` repeatedly, paired by position with the first `--workspace` as the main root; one `--write-sid` per `--workspace` is required whenever the caller owns the grants.
- The SSH helper protocol is version 4, whose policy wire carries `additionalRoots`. A client refuses a helper of protocol 3 before readiness.
- Sessions that edit their directories record `sandbox/additional-roots` events. A released reader that predates the event refuses such a Session instead of resuming it under a narrower policy; the [persistence record](../../../persistence-changes/2026-10-24-sandbox-additional-roots.md) states the format details.

## Migration

1. Add `additionalRoots: []` to every `SandboxExecutionPolicy` or `SandboxPolicy` literal that should keep a single root, or pass the session's list from `ctx.sandboxPolicy.resolve()`.
2. Replace `new AclSandbox({ writableDirs: [root], writeSid: workspaceWriteSid(root), ... })` with `new AclSandbox({ writable: [{ dir: root, writeSid: workspaceWriteSid(root) }], ... })`, adding one entry per extra root with that root's own `workspaceWriteSid(dir)`.
3. If you launch the runner directly, build its argv with `formatRunnerArgs` from `@deepseek-ai/dsh-sandbox-windows-acl`, or repeat `--write-sid` after the `--workspace` list so the counts match.
4. Install the SSH helper built from this release on every remote host before connecting with this release's client.
5. Keep Session logs that contain `sandbox/additional-roots` events away from older releases; open them only with this release or later.
6. Confirm the migration: `pnpm run typecheck` passes, a confined call under `workspace-write` writes inside an added directory, and an SSH connection reaches readiness.
