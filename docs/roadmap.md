# Roadmap

## Назначение документа

Этот документ фиксирует принятые архитектурные решения и план развития `opencode-packman`.

`opencode-packman` — локальный менеджер пакетов для OpenCode-конфигураций. Он управляет установкой, проверкой, удалением и публикацией пакетов, содержащих agents, commands, skills, config patches и другие OpenCode-ресурсы.

Текущий MVP уже подтвердил основную гипотезу: пакетная установка OpenCode-настроек ускоряет настройку проектов и делает изменения воспроизводимыми.

---

## 1. Resource model

`opencode-packman` использует четыре независимых типа ресурсов.

### 1.1. Project state

Project state хранится внутри конкретного проекта.

```text
my-project/
  opencode.json
  .opencode/
    agents/
    commands/
    skills/
  .opencode-packman/
    lock.yaml
    baseline.yaml
```

Project state отвечает за состояние OpenCode-настроек в текущем проекте.

### 1.2. User config

User config хранится в домашней директории пользователя.

```text
~/.opencode-packman/
  registries.yaml
  config.yaml
```

User config отвечает за пользовательские настройки `opm`, список подключённых registry и будущие user-level defaults.

### 1.3. Registry storage

Registry storage — это папка с reusable-пакетами.

```text
~/dev/opencode-packs/
  packages/
    base-review/
      package.yaml
    docs-helper/
      package.yaml
```

Registry не является installed state. Registry хранит доступные пакеты, которые можно установить в проекты.

### 1.4. Package draft

Package draft — это локальная рабочая копия пакета до публикации.

```text
./base-review/
  package.yaml
  agents/
  commands/
  skills/
  opencode.patch.json
```

Draft можно редактировать, валидировать, тестировать и затем публиковать в registry.

---

## 2. Lockfile and baseline

### 2.1. `lock.yaml`

Файл:

```text
.opencode-packman/lock.yaml
```

`lock.yaml` фиксирует только то, что было фактически установлено через `opm install`.

Он отвечает на вопросы:

* какие пакеты установлены через `opm`;
* какие файлы принадлежат установленным пакетам;
* какие config patches были применены;
* что можно безопасно удалить через `opm remove`.

`lock.yaml` не должен содержать default packages, default skills или любые записи о ресурсах, которые не были установлены через `opm install`.

Пустой `lock.yaml` после `opm init`:

```yaml
schema: opencode-packman/lock/v1
packages: {}
files: {}
patches: {}
```

### 2.2. `baseline.yaml`

Файл:

```text
.opencode-packman/baseline.yaml
```

`baseline.yaml` фиксирует OpenCode-ресурсы, которые уже существовали в проекте на момент `opm init`.

Он отвечает на вопросы:

* какие OpenCode-файлы существовали до управления через `opm`;
* какие unmanaged resources были обнаружены;
* изменились ли эти unmanaged resources после инициализации.

`baseline.yaml` не даёт `opm` ownership над существующими файлами. Эти файлы не должны удаляться через `opm remove`, если они не были установлены пакетом.

Минимальный формат:

```yaml
schema: opencode-packman/baseline/v1
createdAt: 2026-04-24T12:00:00.000Z

files:
  opencode.json:
    checksum: sha256:...
  .opencode/agents/reviewer.md:
    checksum: sha256:...
  .opencode/skills/api-review/SKILL.md:
    checksum: sha256:...
```

---

## 3. Required behavior of `opm init`

`opm init` должен быть безопасной и неинвазивной командой.

Команда обязана:

1. Создать `opencode.json`, если он отсутствует.
2. Создать директорию `.opencode/`, если она отсутствует.
3. Создать директории:

   * `.opencode/agents/`
   * `.opencode/commands/`
   * `.opencode/skills/`
4. Создать директорию `.opencode-packman/`, если она отсутствует.
5. Создать пустой `.opencode-packman/lock.yaml`, если он отсутствует.
6. Создать `.opencode-packman/baseline.yaml` со snapshot существующего OpenCode-состояния.
7. Не перезаписывать существующие файлы.
8. Не устанавливать default packages.
9. Не добавлять default skills.
10. Не создавать lock entries для файлов, которые уже существовали до установки пакетов.
11. Не изменять существующий `opencode.json`, если он уже был создан.
12. Не изменять существующие `.opencode/` resources.

После `opm init` проект должен иметь минимальную структуру:

```text
my-project/
  opencode.json
  .opencode/
    agents/
    commands/
    skills/
  .opencode-packman/
    lock.yaml
    baseline.yaml
```

Если OpenCode уже был настроен до `opm init`, существующие ресурсы должны попасть в `baseline.yaml`, но не в `lock.yaml`.

---

## 4. Package lifecycle

Пакеты проходят через отдельные стадии.

```text
draft → validate → publish → install → doctor → remove
```

### 4.1. Draft

Draft создаётся локально.

```bash
opm package create base-review
```

Результат:

```text
./base-review/
  package.yaml
  agents/
  commands/
  skills/
  opencode.patch.json
```

Draft можно редактировать вручную до публикации.

### 4.2. Validate

Пакет должен проходить валидацию до публикации или установки.

```bash
opm package validate ./base-review
```

Валидация проверяет:

* `package.yaml`;
* schema;
* name;
* version;
* type;
* export paths;
* strategies;
* `SKILL.md`;
* skill frontmatter;
* config patch JSON.

### 4.3. Publish

Публикация копирует готовый пакет в registry.

```bash
opm package publish ./base-review --registry personal
```

Публикация должна:

1. Валидировать пакет.
2. Найти registry по имени.
3. Скопировать пакет в `<registry.path>/packages/<packageName>`.
4. Не изменять source package.
5. Не изменять `package.yaml`.
6. Создать publish metadata внутри опубликованного пакета.

Publish metadata:

```text
.opm/published.yaml
```

Пример:

```yaml
schema: opencode-packman/published/v1
registry: personal
packageName: base-review
version: 0.1.0
publishedAt: 2026-04-24T12:00:00.000Z
sourcePath: /Users/me/dev/package-drafts/base-review
```

Если пакет уже существует в registry, publish должен завершиться ошибкой без `--force`.

Допустимые опции:

```bash
opm package publish ./base-review --registry personal --force
opm package publish ./base-review --registry personal --as base-review-v2
```

### 4.4. Install

Установка применяет пакет к текущему проекту.

```bash
opm install personal/base-review --yes
```

Install должен:

1. Разрешить package reference.
2. Валидировать пакет.
3. Построить install plan.
4. Показать preview.
5. Применить изменения.
6. Записать ownership в `lock.yaml`.

### 4.5. Doctor

Doctor проверяет project state.

```bash
opm doctor
```

Doctor должен учитывать:

* `opencode.json`;
* `.opencode/`;
* `.opencode-packman/lock.yaml`;
* `.opencode-packman/baseline.yaml`;
* installed packages;
* locked files;
* unmanaged baseline files.

### 4.6. Remove

Remove удаляет только те файлы, которыми владеет пакет согласно `lock.yaml`.

```bash
opm remove base-review --yes
```

Remove не должен удалять файлы из baseline, если они не принадлежат установленному пакету.

JSON patches пока не откатываются автоматически. Команда обязана показывать предупреждение.

---

## 5. CLI command domains

CLI должен быть разделён по доменам. Короткие top-level команды могут оставаться как алиасы.

### 5.1. Project commands

Команды текущего проекта:

```bash
opm project init
opm project status
opm project doctor
opm project installed
```

Алиасы:

```bash
opm init
opm doctor
```

### 5.2. Package commands

Команды для создания, проверки, публикации и применения пакетов:

```bash
opm package create <name>
opm package validate <packageRef>
opm package inspect <packageRef>
opm package publish <packagePath> --registry <name>
opm package preview <packageRef>
opm package install <packageRef>
opm package remove <packageName>
opm package search [query]
```

Алиасы:

```bash
opm create package <name>
opm preview <packageRef>
opm install <packageRef>
opm remove <packageName>
opm search [query]
```

### 5.3. Registry commands

Команды управления registry:

```bash
opm registry add <name> <path>
opm registry list
opm registry remove <name>
opm registry packages <name>
```

### 5.4. Config commands

Команды для диагностики путей и пользовательской конфигурации:

```bash
opm config paths
opm config show
```

---

## 6. Milestones

## v0.2.0 — Resource model correction

Цель: сделать состояние проекта, baseline, lockfile и registry концептуально корректными.

**Статус:** done ✅

### Progress

* [x] `opm init` создаёт `opencode.json`, если его нет.
* [x] `opm init` создаёт `.opencode/agents`, `.opencode/commands`, `.opencode/skills`.
* [x] `opm init` создаёт `.opencode-packman/lock.yaml`.
* [x] `opm init` создаёт `.opencode-packman/baseline.yaml`.
* [x] `lock.yaml` после init пустой.
* [x] `lock.yaml` не содержит default packages.
* [x] `lock.yaml` не содержит default skills.
* [x] существующие OpenCode-файлы фиксируются в `baseline.yaml`.
* [x] doctor понимает baseline.
* [x] remove не трогает baseline-only files.
* [x] добавлен `docs/resource-model.md`.
* [x] добавлен `opm config paths`.
* [x] добавлен `opm project status`.
* [x] добавлен `opm project installed`.

### Requirements

* `opm init` создаёт `opencode.json`, если его нет.
* `opm init` создаёт `.opencode/agents`, `.opencode/commands`, `.opencode/skills`.
* `opm init` создаёт `.opencode-packman/lock.yaml`.
* `opm init` создаёт `.opencode-packman/baseline.yaml`.
* `lock.yaml` после init пустой.
* `lock.yaml` не содержит default packages.
* `lock.yaml` не содержит default skills.
* существующие OpenCode-файлы фиксируются в `baseline.yaml`.
* doctor понимает baseline.
* remove не трогает baseline-only files.
* добавлен `docs/resource-model.md`.
* добавлен `opm config paths`.
* добавлен `opm project status`.
* добавлен `opm project installed`.

### Definition of Done

```bash
opm init
opm project status
opm config paths
opm doctor
```

После `opm init`:

```text
.opencode-packman/lock.yaml      # empty installed state
.opencode-packman/baseline.yaml  # snapshot of existing OpenCode files
```

---

## v0.3.0 — Package authoring and publishing

Цель: разделить создание draft package и публикацию в registry.

**Статус:** done ✅

### Progress

* [x] `opm package create <name>` создаёт draft package.
* [x] `opm package validate <packageRef>` валидирует package.
* [x] `opm package inspect <packageRef>` показывает содержимое package.
* [x] `opm package publish <packagePath> --registry <name>` публикует package в registry.
* [x] publish копирует package в `<registry.path>/packages/<packageName>`.
* [x] publish создаёт `.opm/published.yaml`.
* [x] publish не перезаписывает без `--force`.
* [x] publish поддерживает `--as <name>`.

### Requirements

* `opm package create <name>` создаёт draft package в текущей директории или указанном `--dir`.
* `opm package validate <packageRef>` валидирует package.
* `opm package inspect <packageRef>` показывает содержимое package.
* `opm package publish <packagePath> --registry <name>` публикует package в registry.
* publish копирует package в `<registry.path>/packages/<packageName>`.
* publish создаёт `.opm/published.yaml`.
* publish не изменяет source package.
* publish не изменяет `package.yaml`.
* publish без `--force` не перезаписывает существующий registry package.
* publish поддерживает `--as <name>`.

### Definition of Done

```bash
opm package create base-review
opm package validate ./base-review
opm package inspect ./base-review
opm package publish ./base-review --registry personal
opm install personal/base-review --yes
```

---

## v0.4.0 — Package metadata

Цель: сделать пакеты более описательными и пригодными для поиска.

**Статус:** done ✅

### Progress

* [x] поддержка `metadata.tags`.
* [x] поддержка `metadata.author`.
* [x] поддержка `metadata.license`.
* [x] поддержка `compatibility.opencode`.
* [x] поддержка `env.required`.
* [x] поддержка `env.optional`.
* [x] поддержка `risk.level`.
* [x] `opm search --tag <tag>`.
* [x] `opm search --type <type>`.
* [x] `opm package inspect` показывает metadata, env и risk.

### Requirements

* поддержка `metadata.tags`;
* поддержка `metadata.author`;
* поддержка `metadata.license`;
* поддержка `compatibility`;
* поддержка `env.required`;
* поддержка `env.optional`;
* поддержка `risk.level`;
* `opm search --tag <tag>`;
* `opm search --type <type>`;
* `opm inspect` показывает metadata, env и risk.

### Definition of Done

```bash
opm search --tag review
opm search --type bundle
opm package inspect personal/base-review
```

---

## v0.5.0 — Checksums and drift detection

Цель: doctor должен видеть ручные изменения installed files.

**Статус:** done ✅

### Progress

* [x] lockfile хранит checksum installed files.
* [x] doctor определяет missing locked files.
* [x] doctor определяет modified locked files (`locked_target_modified`).
* [x] doctor определяет changed baseline files.
* [x] doctor различает installed managed files и unmanaged baseline files.
* [x] install обновляет checksums.
* [x] remove удаляет ownership entries.

### Requirements

* lockfile хранит checksum installed files.
* doctor определяет missing locked files.
* doctor определяет modified locked files.
* doctor определяет changed baseline files.
* doctor различает installed managed files и unmanaged baseline files.
* install обновляет checksums.
* remove удаляет ownership entries.

### Definition of Done

Если installed file изменён вручную:

```bash
opm doctor
```

должен показать:

```text
WARNING locked_target_modified
```

---

## v0.6.0 — Model aliases

Цель: добавить локальный quasi-router моделей.

### Requirements

* `opm model set <alias> <provider/model>`;
* `opm model list`;
* `opm model remove <alias>`;
* packages могут использовать `model: alias:<name>`;
* install-time alias resolution;
* doctor показывает unknown aliases;
* preview показывает model requirements.

### Definition of Done

```bash
opm model set reviewer anthropic/claude-sonnet-4-5
opm install personal/security-review --yes
opm doctor
```

---

## v0.7.0 — Safety upgrades

Цель: усилить безопасность операций.

### Requirements

* transactional install для replace operations;
* backups для overwritten files;
* rollback при ошибке установки;
* symlink hardening;
* realpath boundary checks;
* permission impact analysis;
* preview показывает permission changes;
* remove может откатывать простые JSON patches через `--revert-patches`.

### Definition of Done

```bash
opm install personal/base-review --yes
opm remove base-review --revert-patches --yes
opm doctor
```

---

## v0.8.0 — Global scope

Цель: поддержать установку пакетов в глобальный OpenCode config.

### Requirements

* `opm preview <packageRef> --global`;
* `opm install <packageRef> --global`;
* `opm doctor --global`;
* `opm remove <packageName> --global`;
* отдельный global lockfile;
* отдельный global baseline;
* явные предупреждения перед global writes.

### Definition of Done

```bash
opm install personal/base-skills --global --yes
opm doctor --global
opm remove base-skills --global --yes
```

---

## v0.9.0 — Package tests and sandbox

Цель: добавить structural sandbox tests для пакетов.

### Requirements

* `opm package test <packageRef>`;
* временный sandbox project;
* init;
* install;
* doctor;
* remove;
* doctor after remove;
* optional `tests/smoke.yaml` inside package.

### Definition of Done

```bash
opm package test personal/base-review
```

---

## v1.0.0 — Stable local package manager

Цель: стабильный local-first менеджер OpenCode-пакетов.

### Requirements

* стабильный package format;
* стабильный lockfile format;
* стабильный baseline format;
* стабильный registry format;
* полная документация;
* migration notes;
* safe install/remove behavior;
* reliable doctor;
* local registry workflow;
* package authoring workflow;
* tests for core lifecycle.

---

## 7. Deferred features

Следующие функции откладываются до стабилизации local-first модели:

* remote registry;
* server registry;
* marketplace import;
* approval workflow;
* multi-user roles;
* UI;
* cloud sandbox;
* complex dependency resolver;
* semver ranges;
* package signing;
* MCP risk scoring.

---

## 8. Current priority

Ближайший обязательный этап:

```text
v0.6.0 — Model aliases
```

Текущее состояние: v0.5.0 закрыт. Следующий этап — v0.6.0.
