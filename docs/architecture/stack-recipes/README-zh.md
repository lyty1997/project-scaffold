# 技术栈参考配方

[English](README.md) | 中文

状态：active
最近更新：__在实际使用时更新为当前日期__

本目录提供在[待决策问题](../open-decisions-zh.md)中选定技术栈后的可选配置，默认不引入依赖。[Python](../../../.claude/rules/python-coding-rules.md) 和 [TypeScript](../../../.claude/rules/typescript-coding-rules.md) 规则保留精简的编码约束，配方提供按需采用的工具设置。命令、依赖和覆盖率要求以项目实际配置为准，规则或配方不会自动作出这些选择。

## 使用方式

1. 先在 [待决策问题](../open-decisions-zh.md) 记录"为什么选这个技术栈、解决什么问题"的决策。
2. 从对应文件复制配置片段到你项目里，按你的实际目录结构调整路径。
3. 落地后如果你项目的配置和这里的参考有出入，改的应该是你项目自己的配置文件——这里只是起点，不是需要持续同步的真相源，不会随你项目演进而自动更新。

## 目录

- [python.md](python-zh.md)：ruff select/ignore、mypy strict + 按模块 overrides、pytest 配置、pre-commit local hooks、pip-tools 依赖锁定。
- [typescript.md](typescript-zh.md)：`eslint.config.js`（`strictTypeChecked` + `stylisticTypeChecked`）、`tsconfig.json` strict 全家桶、vitest 单测/DB 集成测试配置分离。
- [migration-ledger-check.md](migration-ledger-check-zh.md)：数据库迁移编号一致性检查的参考脚本（可选，仅当引入了数据库迁移工具、且用设计文档维护迁移顺序台账时才需要）。
