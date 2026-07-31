# 猎聘候选人采集器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Windows 本地工具，让用户在已登录的猎聘 Chrome 页面上按公司手动搜索时，一键采集当前页、严格筛选金融渠道/机构/同业销售候选人、串行补全详情、人工复核，并安全写入固定九列钉钉表格或导出 TSV。

**Architecture:** Chrome MV3 扩展只读取当前可见列表/详情 DOM并提供侧边栏；Python FastAPI 本地助手监听 `127.0.0.1`，负责规则、SQLite、断点、复核与钉钉；两者通过版本化 JSON 契约和首次配对令牌通信。猎聘搜索和翻页始终由用户完成，连续详情只处理当前页最多 30 个已匹配候选人，遇到任何平台阻断立即暂停。

**Tech Stack:** TypeScript、Vite、Chrome MV3、Vitest、jsdom；Python 3.11+、FastAPI、Pydantic、SQLite、pytest、PyInstaller、Windows DPAPI；钉钉官方开放接口与 TSV 剪贴板兜底。

## Global Constraints

- v1 只实现猎聘，不实现脉脉或领英。
- 不读取或保存 Cookie，不调用猎聘私有接口，不拦截请求，不模拟鼠标，不绕过验证码、登录或访问限制。
- 不采集联系方式，不点击联系方式按钮，不解锁完整姓名。
- Git 只能包含源代码、文档和匿名夹具；真实候选人数据、密钥、令牌、日志、数据库、导出和构建产物必须留在本机并被忽略。
- 钉钉主表只能是九列：`目前公司、姓名、性别、年龄、目前地点、期望地点、目前岗位、硕士学校、本科学校`。
- 每个任务先写失败测试，再写最小实现，再运行局部和全量测试；每个里程碑形成独立、可审阅提交。

---

## Task 1: 建立安全项目骨架和质量门槛

**Files:**

- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/vitest.config.ts`
- Create: `extension/src/`
- Create: `helper/pyproject.toml`
- Create: `helper/src/liepin_helper/__init__.py`
- Create: `helper/tests/`
- Create: `contracts/v1/`
- Create: `tests/fixtures/README.md`
- Modify: `.gitignore`

- [ ] 在生活电脑克隆仓库，运行 `git switch -c codex/liepin-v1`，确认 `git status --short --branch` 显示新分支。
- [ ] 固定 Node、TypeScript、Python 依赖版本，配置 `npm test`、`npm run build`、`python -m pytest`、Ruff 或等价静态检查命令。
- [ ] 在 `tests/fixtures/README.md` 写明匿名化规则：真实姓名、公司、学校、候选人键和 URL 必须替换，禁止直接提交网页存档。
- [ ] 增加仓库安全测试，遍历受 Git 跟踪的文件并拒绝数据库、表格、日志、`.env`、令牌模式和未匿名候选人夹具。
- [ ] 运行空骨架测试与构建，预期所有命令成功且没有生成受 Git 跟踪的数据文件。
- [ ] 提交：`chore: scaffold secure extension and helper workspaces`。

## Task 2: 完成钉钉最小权限探针

**Files:**

- Create: `helper/src/liepin_helper/dingtalk/probe.py`
- Create: `helper/src/liepin_helper/dingtalk/models.py`
- Create: `helper/tests/dingtalk/test_probe.py`
- Create: `docs/dingtalk-permission-setup.md`

- [ ] 在钉钉开发者后台创建一个临时企业内部应用，只申请读取目标公司清单和向测试工作表追加/读取数据所需的最小权限。
- [ ] 先用伪造网关写测试，覆盖“权限可用”“无写权限”“表格类型不支持”“令牌失效”四种结果。
- [ ] 实现只执行探针的命令：读取一个测试单元格、追加一条带随机探针 ID 的测试行、读回确认、删除测试行或将其清空。
- [ ] 验证能否访问或创建独立的 `系统索引` 工作表；记录实际 API、权限名称、企业管理员审批路径和失败信息。
- [ ] 把结果写入 `docs/dingtalk-permission-setup.md`。如果直接写入不可用，将运行模式固定为 `tsv_fallback`，后续任务仍继续。
- [ ] 确认 AppSecret 未出现在终端历史、日志、测试快照或 Git 差异中。
- [ ] 提交：`spike: verify DingTalk sheet access and fallback`。

## Task 3: 固定扩展与助手的 v1 契约

**Files:**

- Create: `contracts/v1/page-capture.schema.json`
- Create: `contracts/v1/detail-capture.schema.json`
- Create: `contracts/v1/review.schema.json`
- Create: `contracts/v1/sync.schema.json`
- Create: `contracts/v1/examples/*.json`
- Create: `helper/src/liepin_helper/api/models.py`
- Create: `helper/tests/contracts/test_contracts.py`
- Create: `extension/src/contracts/types.ts`
- Create: `extension/src/contracts/contracts.test.ts`

- [ ] 为公司上下文、搜索关键词、页码、候选人卡片、稳定键、详情、页面阻断状态、复核和同步响应定义 JSON Schema。
- [ ] 将枚举固定为已批准取值，包括搜索词 `渠道/机构/同业`、详情状态和暂停原因。
- [ ] 用匿名示例验证 TypeScript 与 Pydantic 对相同合法输入均接受、对缺字段和额外敏感字段均拒绝。
- [ ] 明确契约中不存在手机号、邮箱、微信、Cookie、请求头或完整姓名字段。
- [ ] 运行 `npm test` 与 `python -m pytest helper/tests/contracts`，预期双端契约测试通过。
- [ ] 提交：`feat: define versioned local capture contracts`。

## Task 4: 实现领域规则和九列映射

**Files:**

- Create: `helper/src/liepin_helper/domain/rules.py`
- Create: `helper/src/liepin_helper/domain/normalize.py`
- Create: `helper/src/liepin_helper/domain/mapping.py`
- Create: `helper/tests/domain/test_rules.py`
- Create: `helper/tests/domain/test_mapping.py`

- [ ] 为全部纳入词逐项写参数化测试。
- [ ] 为全部排除词写优先级测试，特别验证“机构客户服务”被排除。
- [ ] 写当前公司规范名、别名、明确分支命中测试，以及仅历史经历命中时拒绝的测试。
- [ ] 写第一期望地点、最近硕士、最近本科、缺失学历、精确当前地点和年龄留空测试。
- [ ] 写称谓测试：明确男性生成“姓+先生”，明确女性生成“姓+女士”，性别未知保留平台脱敏名并标记人工复核。
- [ ] 实现最小规则与映射，使测试通过；任何无法可靠判断的情况返回 `needs_review`，不得猜测。
- [ ] 提交：`feat: implement candidate qualification and field mapping`。

## Task 5: 实现 SQLite 存储、去重与断点

**Files:**

- Create: `helper/src/liepin_helper/storage/schema.sql`
- Create: `helper/src/liepin_helper/storage/repository.py`
- Create: `helper/src/liepin_helper/storage/paths.py`
- Create: `helper/tests/storage/test_repository.py`
- Create: `helper/tests/storage/test_resume.py`

- [ ] 建表 `companies`、`search_runs`、`candidates`、`candidate_sources`、`detail_jobs`、`sync_records`，添加必要的唯一约束和索引。
- [ ] 测试同一稳定猎聘候选人键只生成一条主记录，而不同关键词和页码分别追加来源。
- [ ] 测试稳定键缺失时使用临时指纹但强制 `needs_review`，不按脱敏姓名单独合并。
- [ ] 测试当前页最多创建 30 个详情作业，重启进程后队列顺序和暂停位置保持不变。
- [ ] 将数据库定位到当前用户 LocalAppData 专用目录，并验证 ACL 初始化只允许当前用户访问。
- [ ] 提交：`feat: persist deduplicated candidates and resumable jobs`。

## Task 6: 实现仅限本机的 FastAPI 服务与配对

**Files:**

- Create: `helper/src/liepin_helper/main.py`
- Create: `helper/src/liepin_helper/api/routes.py`
- Create: `helper/src/liepin_helper/security/pairing.py`
- Create: `helper/src/liepin_helper/security/dpapi.py`
- Create: `helper/tests/api/test_routes.py`
- Create: `helper/tests/security/test_pairing.py`

- [ ] 为六个端点先写 API 测试：页面采集、详情采集、当前页队列、公司复核、公司同步、公司 TSV 导出。
- [ ] 测试服务只绑定 `127.0.0.1`，缺少或错误配对令牌时返回拒绝，CORS 只允许扩展自身来源。
- [ ] 实现一次性配对码换取本地令牌；令牌和 AppSecret 均通过 Windows DPAPI 保存。
- [ ] 确保日志中字段值被删减，只保留匿名键、数量、阶段和错误类别。
- [ ] 运行 API、配对和日志泄露测试。
- [ ] 提交：`feat: expose authenticated localhost helper API`。

## Task 7: 建立猎聘匿名 DOM 夹具和列表解析器

**Files:**

- Create: `tests/fixtures/liepin/list-normal.html`
- Create: `tests/fixtures/liepin/list-filters-active.html`
- Create: `tests/fixtures/liepin/list-dom-mismatch.html`
- Create: `extension/src/liepin/list-parser.ts`
- Create: `extension/src/liepin/filter-detector.ts`
- Create: `extension/src/liepin/list-parser.test.ts`

- [ ] 在用户允许的已登录页面上仅检查 DOM，把最小必要结构手工匿名化后保存；替换所有真实姓名、公司、学校、候选人键和 URL。
- [ ] 先写测试，验证从 `table.new-resume-card` 解析最多 30 张卡片及 23 字符稳定键、脱敏姓名、年龄、学历、地点、当前工作和教育摘要。
- [ ] 写公司/年龄/活跃度/隐藏已看已沟通等可能漏人的筛选警告测试；警告允许用户确认后继续。
- [ ] 写关键 DOM 缺失时返回 `dom_mismatch` 而不是空结果成功的测试。
- [ ] 实现纯 DOM 解析函数，不访问 Cookie、网络响应或私有接口。
- [ ] 提交：`feat: parse visible Liepin result cards safely`。

## Task 8: 建立详情解析器与阻断识别

**Files:**

- Create: `tests/fixtures/liepin/detail-normal.html`
- Create: `tests/fixtures/liepin/detail-login.html`
- Create: `tests/fixtures/liepin/detail-captcha.html`
- Create: `tests/fixtures/liepin/detail-restricted.html`
- Create: `extension/src/liepin/detail-parser.ts`
- Create: `extension/src/liepin/page-state.ts`
- Create: `extension/src/liepin/detail-parser.test.ts`

- [ ] 用匿名夹具先测试性别、教育层级、学校和时间排序解析。
- [ ] 测试登录页、验证码、访问限制、资源消耗提示和 DOM 不匹配都映射为明确暂停原因。
- [ ] 确保详情解析器只返回契约允许字段，姓名仍使用页面脱敏值。
- [ ] 确保任何阻断状态优先于“解析成功”，且不会触发自动重试。
- [ ] 提交：`feat: parse candidate details and detect blockers`。

## Task 9: 实现 MV3 扩展、侧边栏和当前页详情队列

**Files:**

- Create: `extension/manifest.json`
- Create: `extension/src/background/service-worker.ts`
- Create: `extension/src/content/list.ts`
- Create: `extension/src/content/detail.ts`
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/app.ts`
- Create: `extension/src/queue/detail-runner.ts`
- Create: `extension/src/queue/detail-runner.test.ts`

- [ ] 配置最小权限和猎聘、本机助手 host 权限；构建后检查 manifest 中不存在 cookies、webRequest 或不必要的广域权限。
- [ ] 实现“采集本页”：显示公司、关键词、页码、总卡片数、纳入/排除/待复核数和筛选警告。
- [ ] 实现“补全本页详情”：只读取助手返回的当前页队列，最多 30 人，始终复用一个专用标签页并串行导航。
- [ ] 测试标签页关闭、用户导航、助手离线和全部阻断状态会暂停并保存当前位置；只有用户点击“继续”才能恢复。
- [ ] 在侧边栏显示清晰暂停原因、当前序号和剩余人数，不后台无限循环。
- [ ] 构建扩展并在 Chrome 开发者模式加载，使用匿名或测试页面验证按钮、消息通信和断点恢复。
- [ ] 提交：`feat: add Liepin capture and resumable detail side panel`。

## Task 10: 实现人工复核界面

**Files:**

- Create: `extension/src/sidepanel/review.ts`
- Create: `extension/src/sidepanel/review.test.ts`
- Modify: `helper/src/liepin_helper/api/routes.py`
- Create: `helper/tests/api/test_review.py`

- [ ] 展示九列预览、来源关键词/页码、纳入词、排除原因、缺失字段和公司匹配依据。
- [ ] 支持用户确认、排除以及修改九列可编辑字段；修改保留本地审计时间但不记录敏感原始页面全文。
- [ ] 确保性别未知、临时指纹和公司模糊的候选人必须显式确认。
- [ ] 测试未复核候选人调用同步返回拒绝；公司完成状态必须等该公司所有候选人处理完毕。
- [ ] 提交：`feat: require company-level candidate review`。

## Task 11: 实现钉钉幂等同步和 TSV 兜底

**Files:**

- Create: `helper/src/liepin_helper/dingtalk/gateway.py`
- Create: `helper/src/liepin_helper/dingtalk/sync.py`
- Create: `helper/src/liepin_helper/export/tsv.py`
- Create: `helper/tests/dingtalk/test_sync.py`
- Create: `helper/tests/export/test_tsv.py`
- Modify: `extension/src/sidepanel/app.ts`

- [ ] 用伪造钉钉网关测试 `pending -> append -> committed`，以及追加成功但索引提交前崩溃的恢复路径。
- [ ] 测试同步前通过候选人键和九列指纹查询 `系统索引`；重试时先核对主表，不重复追加。
- [ ] 实现首次运行的公司清单表、主表、`系统索引` 选择和映射检查，拒绝非九列表头。
- [ ] 如果 Task 2 证实 API 可用，实现官方接口网关；如果不可用，保持相同同步按钮但返回 TSV 复制界面。
- [ ] 测试 TSV 精确九列、制表符分隔、换行转义、空值和固定顺序，不带候选人键或技术字段。
- [ ] 复制后必须由用户点击“已粘贴”才把公司标记为完成。
- [ ] 提交：`feat: sync reviewed companies idempotently to DingTalk`。

## Task 12: 安全加固、打包与清理向导

**Files:**

- Create: `helper/liepin-helper.spec`
- Create: `helper/src/liepin_helper/cleanup.py`
- Create: `helper/tests/test_cleanup.py`
- Create: `docs/install-windows.md`
- Create: `docs/uninstall-and-delete.md`
- Create: `scripts/verify-release.ps1`

- [ ] 用 PyInstaller 打包助手，验证启动后只监听 `127.0.0.1`，退出后没有遗留外网监听。
- [ ] 在全新 Windows 用户目录实测安装、扩展配对、重启续跑和卸载。
- [ ] 实现清理向导，列出并逐项确认删除扩展、助手凭证、数据库、日志和临时导出；钉钉内部应用需给出后台删除指引。
- [ ] 清理测试必须使用测试目录，验证目标路径在应用专用 LocalAppData 目录内，禁止宽泛递归删除。
- [ ] 运行 `scripts/verify-release.ps1`，包含扩展测试/构建、助手测试/静态检查、敏感信息扫描、manifest 权限检查和打包冒烟测试。
- [ ] 提交：`chore: package, harden, and document cleanup`。

## Task 13: 一家公司端到端验收

**Files:**

- Create: `docs/acceptance-checklist.md`
- Modify: `README.md`

- [ ] 选择一家测试公司，用户手动完成 `渠道`、`机构`、`同业` 三轮搜索和必要翻页。
- [ ] 验证列表采集、严格岗位过滤、公司匹配、稳定键去重和重复来源记录。
- [ ] 对当前页匹配者运行连续详情，人工触发一次暂停并验证可续跑。
- [ ] 人工复核所有候选人，确认九列值、称谓、第一期望地点和最近学历符合规则。
- [ ] 通过钉钉 API 或 TSV 完成公司级同步；重复点击同步，确认主表没有重复行。
- [ ] 检查 Git 状态、日志、数据库目录和构建包，确认 Git 中没有真实候选人数据、密钥、Cookie、日志或导出。
- [ ] 更新 README 为实际安装和日常操作说明，记录验收日期与使用的非敏感版本信息。
- [ ] 运行全量验证并保存不含候选人信息的测试摘要。
- [ ] 提交：`test: complete one-company end-to-end acceptance`。

## Task 14: 发布 v1 与 20 天执行准备

**Files:**

- Create: `docs/operator-runbook.md`
- Create: `docs/20-day-progress-template.md`
- Modify: `CHANGELOG.md`

- [ ] 编写单人日常运行手册：开始公司、三轮检索、翻页、详情、复核、同步、暂停恢复和当日收尾。
- [ ] 建立 20 天本地进度模板，只记录公司与数量，不包含候选人字段；按约 300 家公司规划每日目标并允许回补。
- [ ] 从开发分支创建可审阅 PR，确认 CI、全量测试、安全扫描和一家公司验收均通过。
- [ ] 合并前再次确认钉钉临时应用权限最小化、AppSecret 已加密、本地备份策略符合“不跨电脑同步”的决定。
- [ ] 打标签 `v1.0.0`，发布扩展构建包、助手安装包及校验值到私有发布区，不发布候选人数据。
- [ ] 项目结束时按 `docs/uninstall-and-delete.md` 执行删除，并由用户确认钉钉应用、扩展、助手、密钥、数据库和日志均已清除。

## Verification Commands

在发布候选版本上依次执行，任何一步失败都不能声称完成：

```powershell
Set-Location extension
npm ci
npm test -- --run
npm run build
Set-Location ..\helper
python -m pip install -e ".[dev]"
python -m pytest
python -m ruff check .
Set-Location ..
powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1
git status --short
```

预期结果：测试与构建全部退出码为 0；安全扫描没有命中；manifest 仅含批准权限；Git 工作区干净；端到端验收记录确认重复同步不会新增第二行。
