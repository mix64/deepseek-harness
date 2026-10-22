---
kind: upgrade-guide
description: "沙箱策略携带必填的附加可写根目录，由此改变了 Windows ACL 选项与 runner argv、SSH helper 协议以及 Session 日志。"
---

# 通过沙箱策略传递附加可写根目录

[English](guide.md) | 中文

## 变更

会话的模式为 `workspace-write` 时，除主根目录外还可以写入附加目录。这个新字段会到达每个携带沙箱策略的位置：

- `@deepseek-ai/dsh-sandbox` 的 `SandboxExecutionPolicy`，以及由此派生的 `SandboxPolicy`，新增必填字段 `additionalRoots: readonly string[]`。构造策略字面量的代码缺少该字段时无法通过编译。
- Windows ACL 后端也会授予显式的 `additionalWritableRoots`，每个目录使用各自的能力 SID，而不再以 `SANDBOX_UNSUPPORTED_POLICY` 拒绝。
- `@deepseek-ai/dsh-sandbox-windows-acl` 的 `AclSandboxOptions` 以 `writable: readonly { dir, writeSid }[]` 取代 `writableDirs` 与 `writeSid`，每个根目录对应一个条目和一个能力 SID。
- Windows ACL runner 可重复接受 `--workspace` 与 `--write-sid`，二者按位置配对，第一个 `--workspace` 为主根目录；只要授权由调用方负责，每个 `--workspace` 都必须对应一个 `--write-sid`。
- SSH helper 协议升级为版本 4，其策略报文携带 `additionalRoots`。客户端会在就绪前拒绝协议版本 3 的 helper。
- 编辑过目录的会话会记录 `sandbox/additional-roots` 事件。早于该事件发布的读取方会拒绝这类 Session，而不是在更窄的策略下恢复它；[持久化记录](../../../persistence-changes/2026-10-24-sandbox-additional-roots.zh.md)给出了格式细节。

## 迁移

1. 对每个应保持单一根目录的 `SandboxExecutionPolicy` 或 `SandboxPolicy` 字面量添加 `additionalRoots: []`，或者传入 `ctx.sandboxPolicy.resolve()` 给出的会话列表。
2. 把 `new AclSandbox({ writableDirs: [root], writeSid: workspaceWriteSid(root), ... })` 改为 `new AclSandbox({ writable: [{ dir: root, writeSid: workspaceWriteSid(root) }], ... })`；每多一个根目录，就添加一个使用该根目录自身 `workspaceWriteSid(dir)` 的条目。
3. 如果直接启动 runner，请用 `@deepseek-ai/dsh-sandbox-windows-acl` 的 `formatRunnerArgs` 构造其 argv，或在 `--workspace` 列表之后重复 `--write-sid`，使二者数量一致。
4. 在用本版本客户端连接之前，先在每台远端主机上安装本版本构建的 SSH helper。
5. 不要让旧版本打开包含 `sandbox/additional-roots` 事件的 Session 日志；只用本版本或更新版本打开它们。
6. 确认迁移结果：`pnpm run typecheck` 通过，`workspace-write` 下的受限调用能在已添加的目录中写入，SSH 连接能够就绪。
