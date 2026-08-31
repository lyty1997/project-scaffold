# 工具调用失败处理

[English](../rules/tool-failure.md) | 中文

- 每次工具调用失败后，必须立即停下来自查原因，不得盲目重试
- 分析失败原因后，用不同的方式重试（修正参数、换工具、换思路）
- 禁止连续两次以相同参数（或空参数）调用同一工具
- 把可复用的成功恢复方法记录到下方“已知坑点”章节

## 已知坑点

- 编辑内容超过 200 行时，用边界清晰的多个补丁完成，不要构造一次超大写入。单次 Write 调用不得写入超过 300 行
- 调用Edit工具失败后，检查参数是否正确传入
- Read 工具读取非 PDF 文件时，不要传 `pages` 参数；尤其不要传空字符串（会触发参数校验失败）
- Edit 工具参数名必须使用 snake_case：`file_path` / `old_string` / `new_string` / `replace_all`，不要误写成 `filePath` / `oldString` / `newString` / `replaceAll`
- Edit 的 `old_string` 必须严格逐字符匹配文件内容，禁止"凭记忆敲中文标点"：
  - 全角逗号「，」vs 半角逗号「,」、全角括号「（）」vs 半角「()」、全角冒号「：」vs 半角「:」、中英文引号等，只要有一个字符对不上整段都匹配失败
  - 中文代码注释/docstring 里常常混用全角标点，**从 Read 结果里复制粘贴**而不是手敲
  - Edit 失败报 "String to replace not found" 时，第一反应是字符级 diff（标点、空格、不可见字符），不要原样再试一遍；必要时先用 Read 重新读取目标区间再复制 old_string
