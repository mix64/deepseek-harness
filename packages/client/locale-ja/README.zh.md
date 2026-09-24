---
description: "Web GUI 的日语语言包：在设置的语言选择器中加入 日本語，并为随附的客户端命名空间提供日语词典。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-locale-ja

[English](README.md) | 中文

## 概述

本包为 Web GUI 加入日语。挂载后，设置 → 常规 → 语言会在英语和中文旁列出 日本語；浏览器首选语言为日语时，在存储显式选择之前以日语打开。本包为 Web App bundle 中客户端插件注册的每个命名空间提供日语文案；未翻译的键回退到英语。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Web App bundle 把这一行挂在 [`dsh-client-locale`](../locale/README.zh.md) 旁边；它不接受任何配置。删除这一行会把 日本語 从选择器中移除，当前处于日语的选择回到浏览器匹配结果或英语，而已存储的偏好会等待该语言再次注册。

选择 日本語 会设置 `<html lang="ja">`，并立即切换所有经由 slot 渲染的文字。用户、模型、provider 与协议文本保持原样，与其他语言一致。产品标题 `DeepSeek Harness` 与 `tok` 等单位同样保持英文；本包省略标题键，使其回退到英语。日文字形由页面语言决定：随附的字体栈不固定任何 CJK 字体族，因此浏览器会为 `ja` 页面选择日文字体。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

本插件遵循 [`dsh-client-locale`](../locale/README.zh.md) 的语言包约定：一个受管 effect 调用 `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })`，每个命名空间各用一个受管 effect 以单语言形式 `register(ns, 'ja', dict)` 注册词典。语言定义与词典可以任意顺序注册，因此本包不依赖各所有者的激活顺序。

词典位于 [`src/client/locales/`](src/client/locales/)，每个所有者包一个文件。每个文件用 `satisfies JaDictionaries` 检查，这是基于 `LocaleNamespaceMap` 的映射类型：词典可以省略键，但写出所有者已不再声明的键会导致类型检查失败。[`src/client/namespaces.ts`](src/client/namespaces.ts) 把每个所有者的纯类型合并引入程序以完成该检查。在合并表之外注册的命名空间使用无类型的 `UntypedJaDictionaries` 形状。

| 文件 | 作用 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 以受管 effect 注册语言定义与全部词典 |
| [`src/client/locales/index.ts`](src/client/locales/index.ts) | 汇集按所有者划分的词典组 |
| [`src/client/locales/types.ts`](src/client/locales/types.ts) | 带键检查的 `JaDictionaries` 形状 |
| [`src/index.ts`](src/index.ts) | 空的 Host 半部，使 Loader 列出这一行 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [dsh-client-locale](../locale/README.zh.md) —— 本包所扩展的语言目录、回退链与偏好存储。
- [客户端 locale 全面推行决策](../../../.agents/notes/archived/architecture/2026-07-30-client-locale-full-rollout.md) —— 为什么新增语言以插件而非内置 locale 的形式提供。
- [客户端分组地图](../README.zh.md) —— 本包所属的浏览器半部。

-----

<a id="model-experience"></a>
## 模型体验

无。语言包属于浏览器侧 UI 文案，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>

- **所有者新增的键先以英语显示。** 所有者 `zh`/`en` 词典中新增的键，在本包翻译之前于 日本語 下以英语渲染；类型检查只能发现被删除或重命名的键。
- **注册表持有的文字保持注册时的语言。** 在 slot 渲染路径之外捕获的文案遵循 [locale 包的限制](../locale/README.zh.md#known-limitations-and-deferred-work)。
- **只覆盖 Web App bundle 的命名空间。** 该 bundle 之外的实验性客户端插件在 日本語 下保持英语文案。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。本包只在 locale 服务中持有 effect 作用域的注册；其释放与 fallback 查找由行为测试覆盖。
