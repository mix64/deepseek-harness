---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-24-sandbox-additional-roots

[English](2026-10-24-sandbox-additional-roots.md) | 中文

## 概述

新增仅记录在日志中的 sandbox/additional-roots 事件，用于整体替换会话的附加可写根目录列表。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

已有日志不含此事件，解析时仍没有附加根目录。写入此事件时不带 ignorable 标记，因此早于它发布的读取方会在执行、修改或尾部修复之前拒绝该会话，而不会以更窄或不同的策略继续。当前读取方折叠最后一个事件的列表；该列表只扩展 workspace-write 的文件写入范围，执行强制的主机会重新检查每一项。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/sandbox/sandbox-policy：新事件的折叠、恢复、客户端视图、后继策略与上下文渲染用例均通过。

<a id="dev-note"></a>
## 开发备注

无。
