# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-11-27

### Added

- `repo-audit [path]` 命令，扫描任意 git 仓库并输出终端报告
- 五个维度的指标：活跃度、工程规范、代码结构、技术债、提交质量
- 加权总分与等级（A+ ~ F）
- `--html <file>` 生成自包含 HTML 报告（内联 CSS + SVG 图表，可离线打开、可打印）
- `--json` 输出机器可读结果
- `--fail-under <n>` 作为 CI 门禁，低于阈值时退出码为 2
- `--top` / `--weeks` / `--no-color` 输出控制
- 基于指标自动生成「改进建议」列表
- 24 个单元测试 + GitHub Actions 多平台多版本矩阵
