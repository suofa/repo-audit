# 贡献指南

## 开发环境

- Node.js >= 22.18（需要内置 TypeScript 类型擦除，直接运行 `.ts` 源码）
- git

```bash
git clone https://github.com/<your-name>/repo-audit.git
cd repo-audit
npm install
npm test
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm test` | 跑全部单元测试（`node:test`，无需额外测试框架） |
| `npm run typecheck` | 只做类型检查，不产出文件 |
| `npm run build` | 编译到 `dist/`，供 `npm publish` 使用 |
| `npm start -- <path>` | 直接以源码方式运行 CLI |

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
feat(cli): 支持 --fail-under 门禁
fix(metrics): 修正跨时区的周起始日
docs: 补充评分口径说明
test(score): 覆盖 bus factor 边界
```

## 代码约定

- **零运行时依赖**：新增依赖前请先开 issue 讨论。
- 新增指标必须同时补测试，并且测试不能依赖真实时间（用 `options.now` 注入）。
- 任何进入 HTML 的字符串都必须经过 `escapeHtml`。
