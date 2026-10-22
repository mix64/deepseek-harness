---
description: "The shared per-call sandbox policy resolver and current model context for users and maintainers composing, configuring, or debugging file-effect policy across enforcing capabilities."
kind: "package-reference"
---

# @deepseek-ai/dsh-sandbox-policy

English | [中文](README.zh.md)

## Summary

Use this package to apply one file-effect policy to every confined bash, filesystem, and terminal call. Deployments choose a default mode and fallback workspace root, while each session can switch modes and add writable directories independently. Session choices survive restart, and all enforcing capabilities use the same mode and directories for a call. Before each model request, the model receives the effective policy and its directories without an inventory of mounted capabilities.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this package in any composition where sandbox-enforcing capabilities run: it owns the deployment default and the per-session overrides those capabilities consume, and it contributes the current policy to the model's runtime-context snapshot.

### When to choose it

Choose it for every composition with confined capabilities (bash, filesystem, terminal) so one policy home keeps them from drifting into different modes or workspace roots. Skip it only when nothing enforces sandbox policy — with no consumers, the resolved policy has no effect.

### Minimal configuration

Load the package with a default mode; the fail-safe default is `read-only`, and a deployment that wants a workspace-writable agent opts into `workspace-write` explicitly.

```yaml
- name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: workspace-write
    workspaceRoot: /absolute/path/to/workspace
```

| Field | Default | Meaning |
|---|---|---|
| `mode` | `read-only` | The deployment default mode a session starts from, validated at load |
| `workspaceRoot` | `process.cwd()` | Absolute fallback root for agentless calls or sessions without a cwd; relative values fail at load. Normal agent calls use the session's immutable cwd |
| `additionalWritableRoots` | `[]` | Explicit physical absolute directories also writable under `workspace-write`; other confined modes grant no access to them |
| `maxAdditionalRoots` | `16` | Maximum number of additional directories one session may hold |

For a linked Git worktree, the caller can grant its shared Git directory with `additionalWritableRoots`. The caller selects that directory explicitly; the policy does not inspect Git files or grant a parent checkout. These grants are deployment configuration shared by the composition's sessions, rather than saved Session permissions. Granting the entire Git directory also permits changes to hooks and configuration that a later host Git invocation can execute outside the sandbox; use that grant only for trusted tasks. Use physical absolute directory paths. The enforcing host rejects missing paths, files, and symlinked roots, including a directory replaced by a symlink between calls. Remote grants are validated on the remote host.

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-sandbox-policy) is the exhaustive source for every accepted field and its JSDoc.

### Switching a session's mode

A session's mode can be switched at runtime through a UI policy control or an explicit switch; the switch is recorded in the session log and takes effect on the session's next confined call. The switch survives restart through replay, and each session keeps its own mode — two sessions never see each other's state. A switched session keeps its immutable workspace cwd as its main root.

### Additional directories

Besides its main root, a session holds an ordered list of additional writable directories. `/add-dir <dir>` adds one, `/remove-dir <dir>` removes one, and a bare `/add-dir` lists them. An argument that starts with `"` must be exactly one JSON string literal (`/add-dir "E:\\with space"`); a relative path resolves against the main root. A directory is admitted only when it exists as a directory in the execution world, is not a filesystem root, neither equals, contains, nor lies inside the main root, overlaps no other additional directory or temp area, and the list is below `maxAdditionalRoots`. Before an add commits, the sandbox provider confines a probe under the prospective policy, so a backend that grants per root (Windows ACL) grants now and its refusal fails the add. Edits of one session run one at a time, and repeating an add or a remove changes nothing. Only `workspace-write` enforces the list; other modes keep and report it without granting anything. Delegated children start with their parent's list, forks inherit it, and `session.create({ additionalRoots })` starts a session with the admitted subset and reports the rest as `rejectedAdditionalRoots`.

### Failures and recovery

An invalid configured mode is rejected when the plugin loads, so a typo fails loud instead of silently changing policy. A session without a cwd, and agentless calls, fall back to the configured workspace root; a call with an approved explicit mode uses that mode for exactly that call.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains policy resolution, the per-session store, and the model-visible contribution; the observable behavior is fully covered in [Use this package](#use-this-package).

### Resolution precedence

`resolve({ session, mode })` returns one complete per-call policy: an approved explicit mode outranks the session's last `sandbox/mode` event, which outranks the deployment default. The session's immutable `cwd` supplies the workspace root; otherwise the configured fallback applies. The session's last `sandbox/additional-roots` event supplies `additionalRoots`, and agentless calls have none. Absolute execution-world spelling is preserved. Enforcing providers canonicalize the root on their own filesystem, so remote `symlink/..` paths are never resolved on the Harness host.

### The per-session store

A runtime switch is one log-only `sandbox/mode` event on the session it applies to — the switch IS its event, and nothing mutates mode state out of band. `effective = explicit grant ?? fold(events) ?? deployment default`, so an override survives restart by replay and two sessions never see each other's state. Workspace identity needs no event: the immutable `SessionHeader.cwd` recorded at creation is the main root for every call in that session. Each additional-root edit appends one log-only `sandbox/additional-roots` event carrying the complete list; the last one wins, and `source: 'delegation'` marks a list seeded into a child. `successor(before, event)` gives holders of a confined process or runtime the policy a committed event leads to. The events stay log-only; before each request, the owner contributes the current fact to the full runtime-context snapshot, and the agent loop logs that snapshot as a sourced `user/message`.

### Model-visible text

The `sandbox:policy` contribution states the mode's capability-neutral file-effect contract, the recorded session workspace and explicit extra directories under `workspace-write`, and the session's additional directories in every mode when it has any. It does not enumerate mounted capabilities; tool plugins retain operation-specific denial and escalation guidance, approval policy contributes separately to the same snapshot, and plan guidance remains `dsh-plan-mode`'s system section.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `SandboxPolicyService`, `Config` schema, policy resolution and context contribution |
| [`src/session-mode.ts`](src/session-mode.ts) | The `sandbox/mode` event, its fold, and the write path |
| [`src/session-roots.ts`](src/session-roots.ts) | The `sandbox/additional-roots` event and the pure admission and removal planning |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Start with the subsystem reference for the shared vocabulary, then the seam contract and the cross-family decision.

- [Process sandbox subsystem](../../../docs/subsystems/sandbox.md) — modes, per-call policy, and enforcement semantics.
- [Sandbox seam package](../sandbox/README.md) — the confinement contract every enforcing capability implements.
- [historical Cross-family file sandbox decision](../../../.agents/notes/archived/feature/2026-07-14-cross-family-fs-sandbox.md) — why one shared policy home exists.
- [Permission preset surfaces](../../client/ui-permission-presets/README.md) — the Web composer control that edits a session's additional directories.

-----

<a id="model-experience"></a>
## Model Experience

### Current file sandbox policy

#### What the model sees

One `sandbox:policy` contribution in the current runtime-context snapshot for every agent session. It does not enumerate mounted capabilities. Tool plugins retain operation and escalation guidance, approval policy contributes separately to the same snapshot, and plan guidance remains `dsh-plan-mode`'s system section.

##### Read-only

```markdown
Current DSH file policy: read-only. Any available operation enforced by the DSH file sandbox cannot modify files in the standing mode. Do not refuse a required modification from this policy alone: try an available tool normally and follow any denial and escalation guidance it returns.
```

##### Workspace-write

```markdown
Current DSH file policy: workspace-write. Any available operation enforced by the DSH file sandbox may modify files under the session workspace: "<workspace root>". Some platform temporary areas may also be writable.
```

##### Workspace-write with extra directories

```markdown
Current DSH file policy: workspace-write. Any available operation enforced by the DSH file sandbox may modify files under the session workspace: "<workspace root>". Additional writable directories: ["/repo/.git"]. Some platform temporary areas may also be writable.
```

##### Workspace-write with additional directories

```markdown
Current DSH file policy: workspace-write. Any available operation enforced by the DSH file sandbox may modify files under the session workspace: "<workspace root>", and under the additional session directories: "<dir>", "<dir>". Use absolute paths for files in the additional directories. Some platform temporary areas may also be writable.
```

##### Other modes with additional directories

```markdown
<read-only or danger-full-access text> Additional session directories: "<dir>", "<dir>".
```

##### Danger-full-access

```markdown
Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.
```

#### Token effect

One concise durable context message on the first request and each effective policy change; unchanged requests add nothing. `workspace-write` carries the recorded session workspace path, any explicit extra directories, and the session's additional directories; platform-specific temporary paths are summarized without adding host-dependent bytes.

#### KV Cache effect

The stable system prompt remains byte-identical across mode changes. A changed full context snapshot is appended after retained history, preserving the prior cached prefix; subsequent unchanged requests reuse that retained snapshot.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the policy surface this package provides. They are current package constraints, not a general sandbox comparison or a task backlog.

- **Deployment-scoped extra grants** — `additionalWritableRoots` come from configuration and apply to every session; per-session directories are the separate additional roots below. Backend support is defined by [sandbox-local](../sandbox-local/README.md).
- **Additional directories are checked when added and filtered at each call** — a listed directory that later disappears or comes to overlap another root grants nothing until it is valid again, while the policy context still names it until it is removed.
- **File-effect modes only** — `SandboxMode` governs file effects; network and process policy are outside its vocabulary, so no knob here restricts them.
- **Temporary areas are deliberately summarized** — enforcing backends grant different platform temporary areas, which are selected after policy resolution and therefore cannot be enumerated truthfully in the current context.

Policy-context replacements must be counter-tested on denied-then-escalatable tasks to verify that the model still attempts the initial tool call. The [historical five-of-twelve zero-tool-call measurement](../../../.agents/notes/archived/feature/2026-07-06-sandbox.md) records the failure this check prevents.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
