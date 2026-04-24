# Документ для старта проекта `opencode-packman`

Этот документ можно положить в корень пустого проекта как:

```text
PROJECT.md
```

или:

```text
AGENTS.md
```

Если разработка будет идти через OpenCode, лучше начать с `AGENTS.md`, потому что агент сможет читать его как основную инструкцию проекта.

---

# `opencode-packman`: техническое задание для bootstrap проекта

## 1. Назначение проекта

`opencode-packman` — это локальный менеджер пакетов для OpenCode.

Цель первой версии — позволить устанавливать заранее подготовленные OpenCode-пакеты в проектную или глобальную конфигурацию OpenCode.

Пакет может содержать:

```text
agents
commands
skills
mcp config
permission patches
instructions
opencode.json patches
```

MVP должен уметь:

```text
1. Читать локальный пакет из папки
2. Валидировать package.yaml
3. Строить install plan
4. Показывать preview/diff
5. Устанавливать пакет в проект
6. Патчить opencode.json
7. Записывать lockfile
8. Удалять установленный пакет
9. Проверять состояние через doctor
```

На первом этапе не нужно делать:

```text
remote registry
web UI
marketplace integration
approval workflow
sandbox testing
model router
dependency resolver
npm publishing
standalone binary
```

Главная гипотеза MVP:

> Пакетная установка OpenCode-конфигураций полезна даже локально, если она заменяет ручное копирование agents, commands, skills и правок opencode.json.

---

# 2. Технологический стек

Использовать:

```text
Language: TypeScript
Runtime: Node.js
Package manager: pnpm
CLI framework: Commander
Validation: Zod
YAML parser: yaml
Filesystem: fs-extra
JSON patch/merge: собственная простая реализация для MVP
Diff: diff
Terminal colors: chalk
Prompts: prompts
Tests: Vitest
Lint/format: ESLint + Prettier
```

Обоснование:

```text
TypeScript хорошо подходит для будущего UI
Node.js естественен для OpenCode ecosystem
YAML удобен для package.yaml
Zod даёт строгую runtime-валидацию
Commander быстро позволяет собрать CLI
Vitest достаточно прост для MVP
```

---

# 3. Архитектура проекта

Проект должен быть организован как monorepo.

```text
opencode-packman/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  README.md
  AGENTS.md

  apps/
    cli/
      package.json
      tsconfig.json
      src/
        index.ts
        commands/
          init.ts
          preview.ts
          install.ts
          remove.ts
          doctor.ts

  packages/
    core/
      package.json
      tsconfig.json
      src/
        index.ts

        package/
          packageSchema.ts
          packageLoader.ts
          packageValidator.ts

        project/
          projectPaths.ts
          projectDetector.ts
          opencodeConfig.ts

        plan/
          installPlan.ts
          planBuilder.ts
          conflictDetector.ts

        install/
          installer.ts
          fileActions.ts
          jsonPatch.ts

        lock/
          lockSchema.ts
          lockfile.ts
          ownership.ts

        diff/
          diffRenderer.ts

        doctor/
          doctor.ts
          checks.ts

        remove/
          remover.ts

        utils/
          fs.ts
          yaml.ts
          errors.ts

    schemas/
      package.json
      tsconfig.json
      src/
        package.schema.json
        lock.schema.json

  examples/
    packages/
      backend-review/
        package.yaml
        agents/
          code-reviewer.md
        commands/
          review.md
        skills/
          api-review/
            SKILL.md
        opencode.patch.json

  docs/
    package-format.md
    lockfile.md
    cli.md
    roadmap.md
```

---

# 4. Основные сущности

## 4.1. Package

Пакет — это локальная папка с `package.yaml`.

Минимальная структура пакета:

```text
backend-review/
  package.yaml
  agents/
    code-reviewer.md
  commands/
    review.md
  skills/
    api-review/
      SKILL.md
  opencode.patch.json
```

Пример `package.yaml`:

```yaml
schema: opencode-packman/package/v1
name: backend-review
version: 0.1.0
type: bundle
description: Basic backend review setup for OpenCode

exports:
  agents:
    - name: code-reviewer
      path: agents/code-reviewer.md
      strategy: replace

  commands:
    - name: review
      path: commands/review.md
      strategy: add

  skills:
    - name: api-review
      path: skills/api-review
      strategy: replace

  config:
    - path: opencode.patch.json
      strategy: patch
```

Поддерживаемые `type` в MVP:

```text
skill
agent
command
bundle
profile
```

Поддерживаемые `strategy` в MVP:

```text
add
replace
patch
```

Значения:

```text
add      добавить объект, если его нет
replace  заменить существующий объект
patch    смержить JSON-объект в opencode.json
```

---

## 4.2. Install Plan

Перед установкой всегда строится install plan.

Install plan — это список действий, которые будут применены к проекту.

Типы действий MVP:

```ts
type InstallAction =
  | {
      type: "copyFile"
      from: string
      to: string
      strategy: "add" | "replace"
    }
  | {
      type: "copyDirectory"
      from: string
      to: string
      strategy: "add" | "replace"
    }
  | {
      type: "patchJson"
      target: string
      patchFile: string
      strategy: "patch"
    }
```

Install plan должен содержать:

```ts
type InstallPlan = {
  packageName: string
  packageVersion: string
  packageRoot: string
  projectRoot: string
  scope: "project" | "global"
  actions: InstallAction[]
  conflicts: Conflict[]
  warnings: Warning[]
}
```

---

## 4.3. Lockfile

Lockfile хранит сведения о том, что было установлено.

Файл:

```text
.opencode-packman/lock.yaml
```

Минимальный формат:

```yaml
schema: opencode-packman/lock/v1

packages:
  backend-review:
    version: 0.1.0
    source: ../packages/backend-review
    installedAt: 2026-04-24T12:00:00.000Z
    scope: project

files:
  .opencode/agents/code-reviewer.md:
    owner: backend-review
    version: 0.1.0
    strategy: replace

  .opencode/commands/review.md:
    owner: backend-review
    version: 0.1.0
    strategy: add

  .opencode/skills/api-review:
    owner: backend-review
    version: 0.1.0
    strategy: replace

patches:
  opencode.json:
    - owner: backend-review
      version: 0.1.0
      patchFile: opencode.patch.json
```

Lockfile нужен для:

```text
remove
upgrade later
ownership tracking
conflict detection
doctor checks
```

---

## 4.4. Project scope

В MVP обязательно поддержать project scope.

Project scope означает установку в текущий проект:

```text
project/
  opencode.json
  .opencode/
    agents/
    commands/
    skills/
  .opencode-packman/
    lock.yaml
```

Global scope можно добавить сразу, но он не должен усложнять архитектуру.

Global scope:

```text
~/.config/opencode/
  opencode.json
  agents/
  commands/
  skills/
```

Для MVP приоритет:

```text
1. project scope
2. global scope
```

---

# 5. CLI-команды MVP

## 5.1. `init`

Команда:

```bash
opm init
```

или:

```bash
opencode-packman init
```

Создаёт:

```text
.opencode-packman/
  lock.yaml
```

Если `opencode.json` отсутствует, создать минимальный:

```json
{}
```

Если `.opencode/` отсутствует, создать:

```text
.opencode/
  agents/
  commands/
  skills/
```

Поведение:

```text
не перезаписывать существующие файлы без подтверждения
вывести список созданных файлов
```

---

## 5.2. `preview`

Команда:

```bash
opm preview ./examples/packages/backend-review
```

Должна:

```text
1. прочитать package.yaml
2. проверить структуру пакета
3. построить install plan
4. показать действия
5. показать конфликты
6. ничего не менять
```

Пример вывода:

```text
Package: backend-review@0.1.0
Scope: project

Will add:
  .opencode/commands/review.md

Will replace:
  .opencode/agents/code-reviewer.md
  .opencode/skills/api-review/

Will patch:
  opencode.json <- opencode.patch.json

Warnings:
  none

Conflicts:
  none
```

---

## 5.3. `install`

Команда:

```bash
opm install ./examples/packages/backend-review
```

Опции:

```text
--scope project
--scope global
--yes
--dry-run
--mode add
--mode replace
--mode patch
```

В MVP достаточно:

```text
--scope project
--scope global
--yes
--dry-run
```

Поведение:

```text
1. построить install plan
2. показать preview
3. если нет --yes, спросить подтверждение
4. применить действия
5. обновить lockfile
6. вывести результат
```

---

## 5.4. `remove`

Команда:

```bash
opm remove backend-review
```

Должна:

```text
1. найти пакет в lockfile
2. найти все owned files
3. показать, что будет удалено
4. удалить файлы
5. обновить lockfile
```

В MVP можно не откатывать JSON patches полностью, если это сложно.

Но нужно честно вывести предупреждение:

```text
JSON patches are not automatically reverted in MVP.
Please review opencode.json manually.
```

Лучше всё же хранить backup-фрагменты позже, но не в первой версии.

---

## 5.5. `doctor`

Команда:

```bash
opm doctor
```

Проверяет:

```text
opencode.json exists
.opencode directory exists
lockfile exists
all locked files exist
all skills contain SKILL.md
all installed agents exist
all installed commands exist
package ownership has no duplicate conflicts
opencode.patch.json was applied structurally
```

Пример вывода:

```text
Doctor report

OK    opencode.json exists
OK    .opencode directory exists
OK    lockfile exists
OK    skill api-review has SKILL.md
WARN  package backend-review patched opencode.json; automatic revert is not available
OK    no duplicate owned files

Status: healthy
```

---

# 6. Правила установки объектов OpenCode

## 6.1. Agents

Package export:

```yaml
exports:
  agents:
    - name: code-reviewer
      path: agents/code-reviewer.md
      strategy: replace
```

Target path:

```text
.opencode/agents/code-reviewer.md
```

---

## 6.2. Commands

Package export:

```yaml
exports:
  commands:
    - name: review
      path: commands/review.md
      strategy: add
```

Target path:

```text
.opencode/commands/review.md
```

---

## 6.3. Skills

Package export:

```yaml
exports:
  skills:
    - name: api-review
      path: skills/api-review
      strategy: replace
```

Target path:

```text
.opencode/skills/api-review/
```

Skill directory must contain:

```text
SKILL.md
```

Validator must check:

```text
SKILL.md exists
frontmatter contains name
frontmatter contains description
```

---

## 6.4. Config patches

Package export:

```yaml
exports:
  config:
    - path: opencode.patch.json
      strategy: patch
```

Target path:

```text
opencode.json
```

Patch strategy for MVP:

```text
deep merge JSON object
arrays are replaced, not merged
objects are recursively merged
primitive values overwrite previous values
```

Example patch:

```json
{
  "permission": {
    "bash": {
      "rm *": "deny",
      "git *": "ask"
    }
  }
}
```

If `opencode.json` does not exist, create `{}` before applying patch.

---

# 7. Validation rules

## 7.1. Package validation

Validate:

```text
package.yaml exists
schema is supported
name is non-empty
version is semver-like
type is supported
exports exists
all export paths exist
all strategies are supported
skill exports contain SKILL.md
```

Do not overbuild semver. A simple check is enough for MVP:

```text
number.number.number
```

---

## 7.2. Conflict detection

Detect:

```text
target file exists and strategy is add
target file is owned by another package
target directory exists and strategy is add
opencode.json patch is not a JSON object
skill has invalid SKILL.md
```

Conflict example:

```text
Conflict:
  target: .opencode/agents/code-reviewer.md
  reason: file already exists and strategy is add
  resolution: use strategy replace or remove existing file
```

---

# 8. Package example to create

Create example package:

```text
examples/packages/backend-review/
```

## `package.yaml`

```yaml
schema: opencode-packman/package/v1
name: backend-review
version: 0.1.0
type: bundle
description: Basic backend review setup for OpenCode

exports:
  agents:
    - name: code-reviewer
      path: agents/code-reviewer.md
      strategy: replace

  commands:
    - name: review
      path: commands/review.md
      strategy: add

  skills:
    - name: api-review
      path: skills/api-review
      strategy: replace

  config:
    - path: opencode.patch.json
      strategy: patch
```

## `agents/code-reviewer.md`

```md
---
description: Reviews code for maintainability, correctness, and project conventions.
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You are a code review subagent.

Focus on:
- correctness
- maintainability
- security concerns
- missing tests
- unclear naming
- unnecessary complexity

Do not modify files. Return findings grouped by severity.
```

## `commands/review.md`

```md
---
description: Review the current project changes using the code-reviewer agent.
agent: code-reviewer
---

Review the current changes in this project.

Focus on correctness, maintainability, tests, and security concerns.

Return:
1. Critical issues
2. Warnings
3. Suggestions
4. Suggested next actions
```

## `skills/api-review/SKILL.md`

```md
---
name: api-review
description: Review REST and GraphQL API design for consistency, correctness, and maintainability.
compatibility: opencode
---

Use this skill when reviewing API routes, schemas, controllers, service interfaces, REST endpoints, GraphQL resolvers, or OpenAPI specifications.

Check:
- naming consistency
- versioning
- error format
- validation
- authentication and authorization boundaries
- pagination
- idempotency
- backwards compatibility
- observability
- test coverage

Return a structured review with risks and concrete recommendations.
```

## `opencode.patch.json`

```json
{
  "permission": {
    "bash": {
      "rm *": "deny",
      "git *": "ask"
    }
  }
}
```

---

# 9. Implementation order for the agent

The agent must implement in this order.

## Step 1: Initialize project

Create:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore
README.md
```

Root `package.json` should include scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "dev": "pnpm --filter @opencode-packman/cli dev"
  }
}
```

---

## Step 2: Create packages

Create:

```text
packages/core
apps/cli
examples/packages/backend-review
```

---

## Step 3: Implement schema validation

Implement:

```text
packages/core/src/package/packageSchema.ts
packages/core/src/package/packageLoader.ts
packages/core/src/package/packageValidator.ts
```

Expose:

```ts
loadPackage(packageRoot: string): Promise<LoadedPackage>
validatePackage(pkg: LoadedPackage): ValidationResult
```

---

## Step 4: Implement project paths

Implement:

```text
packages/core/src/project/projectPaths.ts
packages/core/src/project/opencodeConfig.ts
```

Functions:

```ts
getProjectPaths(projectRoot: string): ProjectPaths
ensureProjectLayout(projectRoot: string): Promise<void>
readOpencodeConfig(projectRoot: string): Promise<Record<string, unknown>>
writeOpencodeConfig(projectRoot: string, config: Record<string, unknown>): Promise<void>
```

---

## Step 5: Implement install plan

Implement:

```text
packages/core/src/plan/installPlan.ts
packages/core/src/plan/planBuilder.ts
packages/core/src/plan/conflictDetector.ts
```

Function:

```ts
buildInstallPlan(input: {
  packageRoot: string
  projectRoot: string
  scope: "project" | "global"
}): Promise<InstallPlan>
```

---

## Step 6: Implement diff preview

Implement:

```text
packages/core/src/diff/diffRenderer.ts
```

Function:

```ts
renderInstallPlan(plan: InstallPlan): string
```

---

## Step 7: Implement installer

Implement:

```text
packages/core/src/install/installer.ts
packages/core/src/install/fileActions.ts
packages/core/src/install/jsonPatch.ts
```

Function:

```ts
applyInstallPlan(plan: InstallPlan): Promise<InstallResult>
```

---

## Step 8: Implement lockfile

Implement:

```text
packages/core/src/lock/lockSchema.ts
packages/core/src/lock/lockfile.ts
packages/core/src/lock/ownership.ts
```

Functions:

```ts
readLockfile(projectRoot: string): Promise<Lockfile>
writeLockfile(projectRoot: string, lockfile: Lockfile): Promise<void>
updateLockfileFromInstall(plan: InstallPlan, result: InstallResult): Promise<void>
```

---

## Step 9: Implement remove

Implement:

```text
packages/core/src/remove/remover.ts
```

Function:

```ts
removePackage(input: {
  projectRoot: string
  packageName: string
}): Promise<RemoveResult>
```

---

## Step 10: Implement doctor

Implement:

```text
packages/core/src/doctor/doctor.ts
packages/core/src/doctor/checks.ts
```

Function:

```ts
runDoctor(projectRoot: string): Promise<DoctorReport>
```

---

## Step 11: Implement CLI

CLI binary should be:

```text
opm
```

Commands:

```text
opm init
opm preview <packagePath>
opm install <packagePath>
opm remove <packageName>
opm doctor
```

Entry:

```text
apps/cli/src/index.ts
```

---

## Step 12: Add tests

Use Vitest.

Minimum tests:

```text
loads valid package
rejects package without package.yaml
rejects missing export path
builds install plan
detects add conflict
deep merges opencode.patch.json
writes lockfile
doctor detects missing SKILL.md
```

---

# 10. Non-goals for the first implementation

Do not implement yet:

```text
remote package registry
authentication
web UI
approval workflow
sandbox runner
GitHub importer
MCP marketplace importer
model alias router
complex dependency resolution
semantic version ranges
automatic rollback of JSON patches
binary distribution
Homebrew
npm publish
```

---

# 11. Expected MVP behavior

After implementation, this should work:

```bash
pnpm install
pnpm build

mkdir /tmp/test-opencode-project
cd /tmp/test-opencode-project

opm init
opm preview /path/to/opencode-packman/examples/packages/backend-review
opm install /path/to/opencode-packman/examples/packages/backend-review --yes
opm doctor
```

Expected project result:

```text
/tmp/test-opencode-project/
  opencode.json
  .opencode/
    agents/
      code-reviewer.md
    commands/
      review.md
    skills/
      api-review/
        SKILL.md
  .opencode-packman/
    lock.yaml
```

Expected `opencode.json`:

```json
{
  "permission": {
    "bash": {
      "rm *": "deny",
      "git *": "ask"
    }
  }
}
```

---

# 12. README content to generate

The README should explain:

```text
what opencode-packman is
what problem it solves
how to install locally
how to create a package
how to preview install
how to install package
how to remove package
how lockfile works
MVP limitations
roadmap
```

Suggested short description:

> `opencode-packman` is a local package installer for OpenCode configuration packs. It lets you package agents, commands, skills and config patches, preview changes, install them into a project, and track ownership through a lockfile.

---

# 13. Roadmap after MVP

## MVP 1

```text
local packages
project install
preview
doctor
remove
lockfile
```

## MVP 2

```text
global install
local registry
package search
package update
better uninstall with JSON patch rollback
```

## MVP 3

```text
model aliases
profile packages
dependency resolution
GitHub install source
```

## MVP 4

```text
local UI
package builder
visual diff
doctor dashboard
```

## MVP 5

```text
remote registry
approval workflow
sandbox testing
marketplace importers
```

---

# 14. Development rules for the OpenCode agent

When implementing:

```text
prefer small files
prefer pure functions in core
keep CLI thin
put business logic in packages/core
write tests for core first
do not hardcode absolute paths
do not require OpenCode binary for MVP
make filesystem operations explicit and safe
never delete files unless lockfile says package owns them
always show preview before destructive operations
```

Use defensive behavior:

```text
if uncertain, fail with a clear error
if target file exists and strategy is add, stop
if package.yaml is invalid, stop
if skill has no SKILL.md, stop
if JSON patch is invalid, stop
```

Do not silently overwrite user files.

---

# 15. Definition of done for MVP

MVP is done when:

```text
opm init works in empty directory
opm preview shows planned changes for example package
opm install applies example package
opm doctor reports healthy state
opm remove removes installed files from lockfile ownership
tests pass
README explains usage
```

---

# Какие агенты добавить в OpenCode для разработки быстрее

Для этого проекта я бы добавил не много агентов. Достаточно 5–6, чтобы не усложнять окружение.

## 1. `architect`

**Назначение:** проектирование структуры, модулей, API core-пакета.

```md
---
description: Designs architecture, module boundaries, and implementation plans for opencode-packman.
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You are the architecture planning agent for opencode-packman.

Focus on:
- module boundaries
- CLI/core separation
- package format
- install plan design
- lockfile ownership
- safe filesystem operations

Do not edit files. Return implementation plans and risks.
```

Использовать для вопросов вроде:

```text
Как лучше спроектировать install plan?
Где должна жить логика lockfile?
Как разделить CLI и core?
```

---

## 2. `implementer`

**Назначение:** основной агент для написания кода.

```md
---
description: Implements TypeScript code for opencode-packman according to the project plan.
mode: primary
tools:
  write: true
  edit: true
  bash: true
---

You are the main implementation agent for opencode-packman.

Follow AGENTS.md and project architecture.

Rules:
- keep CLI thin
- put business logic in packages/core
- write tests for core behavior
- avoid unsafe overwrites
- validate inputs before writing files
- prefer simple code over abstractions
```

Если используешь встроенный `build`, можно не создавать `implementer`. Но отдельный агент полезен, если хочешь закрепить правила проекта.

---

## 3. `test-writer`

**Назначение:** генерирует unit tests и fixture-based tests.

```md
---
description: Writes Vitest tests and fixtures for package loading, install plans, lockfiles, and doctor checks.
mode: subagent
tools:
  write: true
  edit: true
  bash: true
---

You write tests for opencode-packman.

Focus on:
- package validation
- missing files
- install plan generation
- conflict detection
- JSON patch merge
- lockfile updates
- remove behavior
- doctor checks

Prefer small deterministic tests with temporary directories.
```

---

## 4. `reviewer`

**Назначение:** ревью кода перед commit.

```md
---
description: Reviews TypeScript code for correctness, maintainability, safety, and edge cases.
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You review code for opencode-packman.

Check:
- unsafe filesystem writes
- accidental overwrites
- missing validation
- weak error messages
- lockfile inconsistency
- CLI/core coupling
- untested edge cases

Do not modify files. Return findings grouped by severity.
```

---

## 5. `docs-writer`

**Назначение:** пишет README, package-format docs, CLI docs.

```md
---
description: Writes developer documentation, README sections, and package format docs.
mode: subagent
tools:
  write: true
  edit: true
  bash: false
---

You write clear developer documentation for opencode-packman.

Focus on:
- quick start
- package format
- CLI examples
- lockfile behavior
- limitations
- roadmap

Use concise, practical examples.
```

---

## 6. `safety-auditor`

**Назначение:** проверяет рискованные операции.

```md
---
description: Audits file operations, install strategies, remove behavior, and config patching for safety.
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You audit opencode-packman for safety.

Focus on:
- file deletion
- overwrite behavior
- ownership tracking
- lockfile trust
- JSON patch behavior
- path traversal
- symlink issues
- global config writes

Do not edit files. Return concrete risks and safer alternatives.
```

Особенно полезен, потому что проект будет писать в `.opencode/`, `opencode.json` и потенциально в `~/.config/opencode`.

---

# Какие skills добавить

Skills лучше сделать короткими и прикладными. Они должны помогать агентам выполнять повторяющиеся задачи.

## 1. `typescript-cli-development`

```md
---
name: typescript-cli-development
description: Guidance for building maintainable TypeScript CLI applications with clean core/CLI separation.
compatibility: opencode
---

Use this skill when designing or implementing CLI commands.

Principles:
- CLI layer should parse arguments and display output only.
- Core package should contain business logic.
- Commands should call core functions.
- Avoid filesystem side effects in argument parsing.
- Return structured results from core.
- Render human-readable output in CLI.
```

---

## 2. `safe-filesystem-installer`

```md
---
name: safe-filesystem-installer
description: Safety rules for installing, replacing, patching, and removing files owned by packages.
compatibility: opencode
---

Use this skill when implementing file installation, removal, or overwrite logic.

Rules:
- Never overwrite existing files in add mode.
- Never delete files unless lockfile ownership is known.
- Detect path traversal before writing.
- Normalize paths before comparing.
- Keep writes scoped to project root or approved global root.
- Use preview before destructive actions.
- Prefer atomic writes where practical.
```

---

## 3. `package-format-design`

```md
---
name: package-format-design
description: Guidance for designing and validating opencode-packman package.yaml files.
compatibility: opencode
---

Use this skill when changing package.yaml schema or package loading logic.

A package must:
- declare schema
- declare name
- declare version
- declare type
- declare exports
- reference existing files
- use supported strategies
- be validated before install

Keep the format simple for MVP.
```

---

## 4. `lockfile-ownership`

```md
---
name: lockfile-ownership
description: Guidance for tracking package ownership of installed files and patches.
compatibility: opencode
---

Use this skill when implementing lockfile, remove, update, or conflict detection.

The lockfile should answer:
- which package installed this file?
- which version installed it?
- what strategy was used?
- can it be removed safely?
- does another package own the same target?

Do not rely on filenames alone. Track ownership explicitly.
```

---

## 5. `opencode-package-testing`

```md
---
name: opencode-package-testing
description: Testing strategy for opencode-packman packages, install plans, and doctor checks.
compatibility: opencode
---

Use this skill when writing tests.

Test with temporary directories.

Cover:
- valid package load
- invalid package load
- missing package.yaml
- missing export file
- missing SKILL.md
- add conflict
- replace success
- JSON deep merge
- lockfile update
- remove owned files
- doctor healthy state
- doctor broken state
```

---

# Минимальный набор, который я бы добавил сразу

Чтобы не перегрузить проект, стартовый набор такой:

```text
agents:
  architect
  reviewer
  test-writer
  safety-auditor
  docs-writer

skills:
  safe-filesystem-installer
  package-format-design
  lockfile-ownership
  opencode-package-testing
```

Основной код можно писать встроенным `build` или отдельным `implementer`.

---

# Что положить в проект первым коммитом

Минимальный первый commit:

```text
AGENTS.md
README.md
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore

.opencode/
  agents/
    architect.md
    reviewer.md
    test-writer.md
    safety-auditor.md
    docs-writer.md

  skills/
    safe-filesystem-installer/
      SKILL.md
    package-format-design/
      SKILL.md
    lockfile-ownership/
      SKILL.md
    opencode-package-testing/
      SKILL.md
```
