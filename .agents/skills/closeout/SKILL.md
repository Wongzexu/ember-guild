---
name: closeout
disable-model-invocation: true
description: Session closeout — scan session context and report ADR-worthy decisions, documentation suggestions, and process artifacts. Invoke at session boundaries with /closeout.
---

# Closeout

Closeout is the practice of **closing out a session** — the handover between tasks. It reads the current session's context, produces a compact Markdown report with three sections, and exits without modifying any files. Closeout is **non-destructive**: it reads, identifies, and suggests, never writes.

Use closeout at session boundaries: after finishing one task and before starting another, or at the end of a work block. Invoke with `/closeout`.

Closeout checks for project files (`docs/adr/`, `docs/*.md`) relative to the current working directory. If the project has no ADR or docs directory, Parts 1 and 2 will be empty.

## Steps

### 1. Gather session signals

从本 session 已完成的工作中提取三类信号。不要重新扫描对话历史：

- **Decision signals** — explicit choices with rationale: language like "决定", "改用", "选 X 而非 Y", "因为", trade-off language, rejected alternatives
- **File signals** — files created, modified, moved, or deleted during this session
- **Debt signals** — TODO / FIXME / HACK / XXX comments added, dead code noted, config changes discussed

Then verify and enrich with filesystem checks:

- `git status --short` — see all changed, staged, and untracked files
- `git diff --name-only` — exact list of modified files
- `glob("docs/adr/*.md")` — list existing ADRs for cross-reference
- `glob("docs/WenDang/**/*.md")` — list existing WenDang lifecycle documents

If nothing was done this session (no signals at all), skip to Step 5 with all sections empty.

**Completion criterion:** All three signal types checked, git and glob results collected, and a decision recorded whether the session has content or not.

### 2. Identify ADR candidates

From the decision signals gathered in Step 1, filter using all three conditions. A decision qualifies only if **every condition is true**:

1. **Hard to reverse** — changing this later costs meaningful effort
2. **Surprising without context** — a future reader would look at the code and wonder "why?"
3. **Real trade-off** — genuine alternatives existed and one was picked for specific reasons

Cross-check against existing ADRs (`docs/adr/*.md` from Step 1):
- Read each existing ADR's title/opening paragraph to understand scope
- If a candidate is already recorded, skip it with a note: "already covered by ADR-NNN"
- If a candidate extends or contradicts an existing ADR, note the relationship

A candidate that passes all three conditions but is **process/rules-oriented rather than architecture/design-oriented** should be suggested as a `docs/WenDang/YiJian/` entry instead of an ADR. Refer to `docs/WenDang/文档生命周期管理规范.md` for the distinction.

**Completion criterion:** Each decision signal either passed the filter (with relationship to existing ADRs and WenDang docs checked) or was rejected with the condition it failed.

### 3. Identify documentation suggestions

From the gathered signals, find content that could update existing project docs under `docs/*.md`:

| If the session produced... | ...check relevance to |
|---|---|
| New or changed API endpoints / response formats | `docs/API.md` |
| Architecture changes, new patterns, changed constraints | `docs/adr/` (relevant existing ADR), or flag as new ADR candidate |
| Process / rules / specifications agreed upon this session | `docs/WenDang/YiJian/` or `docs/WenDang/BanFa/` — check existing WenDang docs and suggest update or new entry |
| Changed assumptions or configuration guidance | Any matching doc |

For each match, state the target doc, the content that could be added or changed, and a brief opinion on priority (now vs later vs skip).

Then evaluate whether a **handover document** would be valuable. A handover document is a lightweight note — not tracked in git — for the next person or session to pick up context. Do not draft it, only suggest if any of these triggers fire:

| Trigger | Signal |
|---|---|
| Multi-threaded work | `git status --short` shows changes in 2+ unrelated directories |
| Exploration-heavy | Many more files read than changed (recall vs git diff) |
| Uncommitted work | Changes remain at session end |
| Environment drift | Config files, dependencies, tooling, or env vars changed |
| Unfinished sequence | A task was interrupted and has clear next steps |

If any trigger fires, suggest writing a handover document with a brief rationale. Format:

> 建议写交接文档：{原因}。建议记录当前状态、下一步起点和关键上下文。

Then check whether any project tracked in `docs/WenDang/` has reached completion and should be archived to GuiDang:

- Scan `docs/WenDang/YiJian/` and `docs/WenDang/BanFa/` for files referencing projects touched this session
- For each match, check if the project has an associated `YanShou/` report (optional) and no sign of active work (no recent git commits affecting that topic, no open TODO/issue mentions)
- If conditions met → add a suggestion to the report:

> **归档建议**: "{项目名}"已完成实施，建议运行 `/guidang 项目名` 执行归档。

**Completion criterion:** Every decision and file signal cross-referenced against existing `docs/*.md` files. Additionally, triggers checked and handover suggestion made if warranted; project completion scan done. Both steps skipped if no docs exist.

### 4. Identify process artifacts

From gathered signals plus workspace inspection, check for these categories:

| Category | What to look for |
|---|---|
| Test files | `.test.ts`, `.spec.ts`, `__tests__/`, `e2e/` entries created or modified |
| Test config / infra | `vitest.config.*`, `playwright.config.*`, `test-setup.*`, `jest.config.*`, CI workflow files (`.github/workflows/*.yml`) |
| DB / log / cache | `.db`, `sqlite.db`, `.log`, `.tmp`, generated cache files |
| Build / CI artifacts | `coverage/`, `test-results/`, `playwright-report/`, screenshots |
| Technical debt | `TODO:`, `FIXME:`, `HACK:`, `XXX:` in files changed this session |
| Event listeners / watchers | `addEventListener`, `.on(` (EventEmitter / stream), `WebSocket.onmessage`, `ResizeObserver`, `MutationObserver`, `IntersectionObserver`, `setInterval`, `setTimeout` — grep in diff hunks and check if paired with cleanup (`removeEventListener`, `.off(`, `.disconnect()`, `clearInterval`, `clearTimeout`, cleanup return) |

For artifacts found: list path, category, and a one-line action tip ("consider .gitignore", "review before commit", "clean up after verification").

**Event listener check behavior**

For each file in the diff, grep for listener-binding patterns. If a match is found, check the same file for the corresponding cleanup pattern within a reasonable proximity (same function/component/effect scope). Report:

- **{file}:{line}** — `addEventListener` without `removeEventListener` in same scope → "review: listener may leak"
- If the pair is complete → skip with no report (assumed clean)

Pattern matching is heuristic — false negatives (missed listeners) are acceptable; false positives (spurious cleanup warnings) should be minimized. When unsure, flag it and let the user decide.

**Completion criterion:** All six categories checked. If the workspace has no matching patterns, state that explicitly.

### 5. Present the closeout report

If all three content sections (ADR candidates, doc suggestions, process artifacts) are empty → print exactly one line:

> 本 session 无 closeout 产出。

Otherwise → produce this Markdown block:

```markdown
## Closeout Report

### 1. ADR Candidates（ADR 候选）
{one item per candidate, or "无"}

### 2. Documentation Suggestions（文档建议）
{one item per suggestion, or "无"}

### 3. Process Artifacts（过程产物）
{one item per artifact, or "无"}

### 4. 总结
{本 session 关键产出的一句话总结, or "无"}
```

For each candidate/suggestion/artifact/summary, use the format:

```
- **{title/path}**: {finding} — {action tip}
```

No emoji, no fluff, no interpretation beyond what the steps produced. The report is terminal output for the user to act on.

**Completion criterion:** Report printed. Skill ends.

## Completion Criterion

Closeout is complete when signals have been gathered, all six artifact categories checked, all four report sections analyzed and cross-checked, and the report presented or the one-line skip printed.
