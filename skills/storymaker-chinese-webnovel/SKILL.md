---
name: storymaker-chinese-webnovel
description: Use this skill when working in a StoryMaker project for Chinese webnovel creation, especially when the user asks to set up project.yaml, 00-项目企划案.md, or 00-项目假设.md; plan volumes, arcs, chapters, hooks, payoffs, or pacing; write the next chapter from a StoryMaker work packet; or review Chinese webnovel drafts for hook strength, protagonist agency, conflict,爽点 density, suspense, continuity, and AI-flavored prose. Use it with StoryMaker CLI flows such as storymaker produce packet, draft submit, approve, reject, and revise.
---

# StoryMaker Chinese Webnovel

## Core Rule

Keep StoryMaker as the workflow authority and use this skill as the Chinese webnovel craft layer.

Do not silently bypass StoryMaker state. In an initialized StoryMaker project, prefer this loop:

```bash
storymaker status
storymaker resume
storymaker produce packet --unit next --json
# write a real Markdown draft from the packet
storymaker draft submit --unit <unit> --from <draft.md> --title "<chapter title>" --json
```

Never run `approve` or `reject` unless the user explicitly says the chapter is approved or rejected.

## Mode Selection

Use `setup` when the user needs前期设定, project initialization, or files such as `project.yaml`, `00-项目企划案.md`, and `00-项目假设.md`.

Use `outline` when the user needs volume, arc, unit, or chapter planning.

Use `draft` when the user asks to continue writing, write the next chapter, or produce chapter正文.

Use `review` when the user asks whether a chapter passes, wants质量审查, or asks why a draft feels weak.

If the mode is unclear, inspect the StoryMaker state first and choose the safest mode. If project files are missing or vague, start with `setup`; if a work unit is ready and no chapter is awaiting review, use `draft`; if a chapter is awaiting review, use `review`.

## Setup Mode

Goal: guide the author into complete, usable setup files without inventing core creative commitments.

1. Run or inspect:

```bash
storymaker status
```

If StoryMaker is not initialized, tell the user to run:

```bash
storymaker init --type superlong_webnovel --profile production
```

2. Read, if present:

```text
project.yaml
00-项目企划案.md
00-项目假设.md
```

3. Ask at most three questions per turn. Start broad, then narrow:

- 类型、篇幅、读者定位、更新节奏
- 一句话故事、核心卖点、差异化标签
- 主角身份、欲望、缺陷、成长线
- 世界观规则、金手指、能力代价、限制
- 主线冲突、反派或阻力、阶段性目标
- 开篇钩子、前三章承诺、首个爽点
- 长线悬念、伏笔、阶段回收点
- 风格偏好、禁写内容、雷区

4. After each answer, update only the relevant setup files. Preserve existing user decisions. Mark uncertain items as assumptions instead of pretending they are settled.

5. Stop before chapter drafting. End each setup turn with:

- 已补全内容
- 仍缺的关键设定
- 下一轮最多三个问题

## Outline Mode

Goal: turn setup files into webnovel pacing plans that are usable by StoryMaker units.

Read setup files and, when useful:

```bash
storymaker search "<关键角色或设定>"
storymaker context --unit <unit>
```

Plan with these Chinese webnovel heuristics:

- 每章有明确目标、阻力、转折、结尾牵引。
- 主角要主动选择，少靠旁白解释和巧合推进。
- 爽点来自“期待建立 -> 压力升级 -> 代价或反转 -> 兑现”。
- 伏笔要记录触发条件和预计回收位置。
- 单元结尾要有阶段性兑现，不只堆悬念。
- 长篇节奏优先可持续，不要每章都用同一种危机。

Output plans in Markdown tables when helpful:

```text
章节 | 目标 | 冲突 | 爽点/情绪兑现 | 伏笔 | 章末钩子 | 风险
```

Do not overwrite canon or workflow state unless the user asks you to update files.

## Draft Mode

Goal: write one real Chinese webnovel chapter from a StoryMaker work packet and submit it to review.

1. Check state:

```bash
storymaker status
storymaker resume
```

If a chapter is already awaiting review, do not create another chapter. Show the pending item and switch to `review`.

2. Build the work packet:

```bash
storymaker produce packet --unit next --json
```

Use the packet as binding context: unit id, target output path, sources, gaps, constraints, quality gates, and pending knowledge path.

3. Write a real Markdown draft. Avoid placeholders. Preserve Chinese readability.

Draft standards:

- Open with a concrete disturbance, choice, image, or pressure, not a lore lecture.
- Give the protagonist an active decision within the chapter.
- Keep scene causality clear: 因为 A，所以 B；B 迫使 C。
- Let exposition emerge through action, dialogue, conflict, or consequence.
- Keep paragraphs varied and readable on mobile.
- End with a hook that changes reader expectation or creates a next-step question.
- Avoid generic AI prose such as over-neat summaries, abstract adjectives, repeated emotional labels, and “他意识到事情远比想象复杂” unless made specific.

If the draft introduces new facts, add a hidden fact block only when StoryMaker supports the project convention:

````markdown
```storymaker-facts
[
  {
    "type": "character|place|item|foreshadowing|timeline|rule",
    "title": "...",
    "summary": "...",
    "confidence": "draft"
  }
]
```
````

4. Save the draft to a temporary or project-appropriate Markdown file, then submit:

```bash
storymaker draft submit --unit <unit> --from <draft.md> --title "<chapter title>" --json
```

5. Report to the user:

- 章节标题和正文路径
- 质量报告路径
- 待确认知识更新摘要
- “是否通过？”

Do not approve your own draft.

## Review Mode

Goal: judge whether a pending chapter meets Chinese webnovel and StoryMaker quality requirements.

Read:

```bash
storymaker resume
```

Then inspect the staged chapter, quality report, and pending knowledge updates.

Review against this checklist:

- 开篇钩子是否在前几段建立压力或期待
- 主角是否有主动目标和行动
- 冲突是否逐步升级，而不是平铺解释
- 爽点是否有铺垫、兑现和后果
- 章末是否有继续阅读的牵引
- 设定、时间线、能力、物品是否与知识库冲突
- 新事实是否进入 pending knowledge，而不是直接污染 canon
- 文风是否自然中文，是否有 AI 味、模板腔、说明腔
- 章节是否履行当前 work packet 的目标

Use severity:

- P0: breaks canon, loses chapter, unsafe output, or workflow corruption
- P1: major continuity, protagonist agency, or chapter-goal failure
- P2: pacing, hook, scene logic, or payoff problems that need revision
- P3: polish suggestions, line-level prose, stronger imagery or rhythm

If the user says “通过” or equivalent, run:

```bash
storymaker approve --unit <unit>
```

If the user says “打回” or gives a rejection reason, run:

```bash
storymaker reject --unit <unit> --reason "<reason>"
```

If the user asks for revision after rejection, run the appropriate mode:

```bash
storymaker revise --unit <unit> --mode light
storymaker revise --unit <unit> --mode rewrite
storymaker revise --unit <unit> --mode add_hook
storymaker revise --unit <unit> --mode reduce_fluff
```

Choose `light` for small edits, `rewrite` for structural failure, `add_hook` for weak opening or ending, and `reduce_fluff` for excessive explanation.

## Output Style

Write to the user as a writing collaborator, not as a generic code assistant.

For setup and outline, be inquisitive and concise.

For draft, deliver the chapter path, report path, and approval question. Avoid explaining every StoryMaker command unless the user asks.

For review, lead with the decision:

```text
结论：建议通过 / 建议打回 / 建议修改后再审
```

Then list the highest-severity findings first.

## Boundaries

Do not write future chapters in the same turn unless the user explicitly asks.

Do not rewrite project canon without showing the change.

Do not invent setup commitments when the user has not answered; mark assumptions and ask follow-up questions.

Do not use `storymaker produce next --placeholder` for real writing. It is only for deterministic development or tests.

Do not expose long internal command logs unless they matter to the user.
