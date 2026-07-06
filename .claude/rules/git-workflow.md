# Git 工作流
## 分支
- `main`：稳定发布，不直接提交
- `dev`：开发主干
- `feature/s{N}-{描述}` / `bugfix/{描述}` / `release/{版本}`

## 提交格式
```
<type>(<scope>): <中文主题>
```
type: `feat|fix|docs|style|refactor|test|chore`  scope: `core|agents|memory|skills|tools|tui|meeting`
- 不要带上"Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

## 提交前
- 运行风格检查和测试，确保无敏感信息
