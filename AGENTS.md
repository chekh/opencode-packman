# Документ для старта проекта `opencode-packman`

Если разработка идёт через OpenCode, начинай с этого файла.
Пока кодовой базы почти нет, основной источник правды также дублируется в `docs/init.md`.

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

## 2. Технологический стек

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

---

## 3. Архитектура проекта

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

Ключевые правила архитектуры:

- CLI должен быть тонким: только аргументы, вызовы core и рендер вывода.
- Вся бизнес-логика должна жить в `packages/core`.
- Предпочитать маленькие файлы и чистые функции.
- Сначала проектировать `project` scope, потом `global`.
- Не требовать установленный OpenCode binary для MVP.
- Не хардкодить абсолютные пути.

---

## 4. Основные сущности

### 4.1. Package

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

### 4.2. Install Plan

Перед установкой всегда строится install plan.

Типы действий MVP:

```ts
type InstallAction =
  | {
      type: 'copyFile';
      from: string;
      to: string;
      strategy: 'add' | 'replace';
    }
  | {
      type: 'copyDirectory';
      from: string;
      to: string;
      strategy: 'add' | 'replace';
    }
  | {
      type: 'patchJson';
      target: string;
      patchFile: string;
      strategy: 'patch';
    };
```

Install plan должен содержать:

```ts
type InstallPlan = {
  packageName: string;
  packageVersion: string;
  packageRoot: string;
  projectRoot: string;
  scope: 'project' | 'global';
  actions: InstallAction[];
  conflicts: Conflict[];
  warnings: Warning[];
};
```

### 4.3. Lockfile

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

### 4.4. Project scope

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

Приоритет MVP:

```text
1. project scope
2. global scope
```

---

## 5. CLI-команды MVP

### `init`

- Создаёт `.opencode-packman/lock.yaml`.
- Если `opencode.json` отсутствует, создать `{}`.
- Если `.opencode/` отсутствует, создать `agents`, `commands`, `skills`.
- Не перезаписывать существующие файлы без подтверждения.
- Выводить список созданных файлов.

### `preview <packagePath>`

- load -> validate -> build install plan -> показать actions/conflicts/warnings.
- Ничего не менять на диске.

### `install <packagePath>`

Поддержать в MVP:

```text
--scope project
--scope global
--yes
--dry-run
```

Поведение:

- построить install plan
- показать preview
- если нет `--yes`, спросить подтверждение
- применить действия
- обновить lockfile
- вывести результат

### `remove <packageName>`

- найти пакет в lockfile
- найти все owned files
- показать, что будет удалено
- удалить файлы
- обновить lockfile
- не откатывать JSON patches автоматически в MVP
- обязательно предупреждать:

```text
JSON patches are not automatically reverted in MVP.
Please review opencode.json manually.
```

### `doctor`

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

---

## 6. Правила установки объектов OpenCode

Маппинг exports:

- `agents/<name>.md` -> `.opencode/agents/<name>.md`
- `commands/<name>.md` -> `.opencode/commands/<name>.md`
- `skills/<name>/` -> `.opencode/skills/<name>/`
- `config` patch -> `opencode.json`

Для skills обязательно:

- директория содержит `SKILL.md`
- в `SKILL.md` есть frontmatter с `name` и `description`

Для config patch:

- если `opencode.json` нет, сначала создать `{}`
- patch должен быть JSON object
- merge rules MVP:
  - objects рекурсивно merge
  - arrays заменяются целиком
  - primitive values overwrite

---

## 7. Validation rules

Проверять до построения плана:

- `package.yaml` существует
- `schema` поддерживается
- `name` непустой
- `version` в формате `number.number.number`
- `type` поддерживается
- `exports` существует
- все export paths существуют
- все strategies поддерживаются
- каждый skill export содержит `SKILL.md`

Conflict detection:

- target file exists and strategy is add
- target file is owned by another package
- target directory exists and strategy is add
- `opencode.json` patch is not a JSON object
- skill has invalid `SKILL.md`

---

## 8. Package example to create

Держать fixture в:

```text
examples/packages/backend-review/
```

В нём должны быть:

- `package.yaml`
- `agents/code-reviewer.md`
- `commands/review.md`
- `skills/api-review/SKILL.md`
- `opencode.patch.json`

---

## 9. Implementation order

Реализовывать в таком порядке:

1. bootstrap monorepo
2. `packages/core`, `apps/cli`, example package
3. schema validation
4. project paths + opencode config
5. install plan + conflicts
6. diff preview
7. installer + JSON patch
8. lockfile + ownership
9. remove
10. doctor
11. CLI
12. tests

---

## 10. Non-goals

Не делать в первой версии:

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

## 11. Expected MVP behavior

После реализации должно работать:

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

Ожидаемый результат в проекте:

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

---

## 12. README

README должен объяснять:

- что такое `opencode-packman`
- какую проблему он решает
- как установить локально
- как создать пакет
- как сделать preview
- как установить пакет
- как удалить пакет
- как работает lockfile
- ограничения MVP
- roadmap

Короткое описание:

> `opencode-packman` is a local package installer for OpenCode configuration packs. It lets you package agents, commands, skills and config patches, preview changes, install them into a project, and track ownership through a lockfile.

---

## 13. Development rules for OpenCode agent

При реализации:

- prefer small files
- prefer pure functions in core
- keep CLI thin
- put business logic in `packages/core`
- write tests for core first
- do not hardcode absolute paths
- do not require OpenCode binary for MVP
- make filesystem operations explicit and safe
- never delete files unless lockfile says package owns them
- always show preview before destructive operations

Defensive behavior:

- if uncertain, fail with a clear error
- if target file exists and strategy is add, stop
- if `package.yaml` is invalid, stop
- if skill has no `SKILL.md`, stop
- if JSON patch is invalid, stop
- do not silently overwrite user files

Безопасность:

- проверяй path traversal
- нормализуй пути перед сравнением
- держи записи в пределах project root или разрешённого global root
- учитывай symlink risks при записи и удалении

GitFlow (обязательно):

- базовая ветка разработки: `dev`
- для каждой новой фичи или фикса создаётся отдельная ветка от `dev`
- рекомендуемый нейминг веток: `feature/<slug>` и `fix/<slug>`
- разработка и коммиты выполняются в feature/fix ветке, не в `dev`
- по завершении задача сливается обратно в `dev` через PR/review
- крупные стабильные изменения периодически сливаются из `dev` в `main`
- в `main` не коммитить напрямую

Проверки качества перед merge в `dev`:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- при изменениях CLI flow дополнительно: `pnpm smoke`

---

## 14. Тестовый минимум

Покрыть Vitest-тестами:

- loads valid package
- rejects package without `package.yaml`
- rejects missing export path
- builds install plan
- detects add conflict
- deep merges `opencode.patch.json`
- writes lockfile
- doctor detects missing `SKILL.md`

---

## 15. Definition of done

MVP готов, когда:

- `opm init` работает в пустой директории
- `opm preview` показывает план для example package
- `opm install` применяет example package
- `opm doctor` даёт healthy report
- `opm remove` удаляет owned files и обновляет lockfile
- тесты проходят
- README объясняет usage

---

## 16. Рекомендованные агенты и skills

Если в проект добавляются локальные OpenCode-ресурсы, минимальный полезный набор такой:

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

Можно добавить `implementer`, но это необязательно.

---

## 17. Для будущих сессий OpenCode

- Начинай с `docs/init.md`, пока кодовой базы почти нет.
- Сначала читай root manifests, workspace config и package scripts; не угадывай команды.
- После изменений обязательно запускай найденные в репо `lint` и `typecheck` команды; если их ещё нет, добавь их при bootstrap.
- Если пользователь просит помощь по OpenCode, напомни: `/help`; feedback: https://github.com/anomalyco/opencode/issues
