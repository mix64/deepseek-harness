---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-24-sandbox-additional-roots

English | [中文](2026-10-24-sandbox-additional-roots.zh.md)

## Summary

Adds the log-only sandbox/additional-roots event, which replaces a session's complete list of additional writable roots.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-24-sandbox-additional-roots
baseline: false
changes:
  - root: "event:sandbox/additional-roots"
    previous: null
    after: "8a61c5175d1ef8e79b565b1cda22132d30ef2a3028bde257516c22f5a796b7aa"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing logs contain no such event and keep resolving with no additional roots. The event is written without the ignorable marker, so a released reader that predates it refuses the Session before execution, mutation, or tail repair instead of resuming with a narrower or different policy. Current readers fold the last event's list; the list only widens workspace-write file effects and the enforcing host re-checks every entry.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/sandbox/sandbox-policy: the fold, resume, client view, successor, and rendered-context cases for the new event pass.

<a id="dev-note"></a>
## Dev Note

None.
