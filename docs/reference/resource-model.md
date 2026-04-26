# Resource Model

`opencode-packman` разделяет данные по разным доменам. Это нужно, чтобы не смешивать состояние проекта, пользовательские настройки и содержимое registry.

## Project state

Состояние текущего проекта:

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

`opm init` создаёт `opencode.json` и `.opencode/*`, если они отсутствуют.

## User config

Пользовательская конфигурация:

```text
~/.opencode-packman/
  registries.yaml
  config.yaml
```

Здесь живут registry aliases и будущие user-level настройки.

## Registry storage

Registry хранит доступные reusable-пакеты. Это не installed state:

```text
~/dev/opencode-packs/
  packages/
    base-review/
      package.yaml
```

## Package draft

Draft package - локальная рабочая папка до публикации:

```text
./base-review/
  package.yaml
  agents/
  commands/
  skills/
  opencode.patch.json
```

## `lock.yaml`

Файл: `.opencode-packman/lock.yaml`

- фиксирует только то, что реально установлено через `opm install`;
- хранит ownership файлов и applied patches;
- используется `remove` и `doctor`.

После `opm init` lockfile пустой:

```yaml
schema: opencode-packman/lock/v1
packages: {}
files: {}
patches: {}
```

`lock.yaml` не является registry. Он не хранит каталог пакетов и не должен содержать default packages/default skills.

## `baseline.yaml`

Файл: `.opencode-packman/baseline.yaml`

- snapshot OpenCode-файлов на момент `opm init`;
- хранит checksum unmanaged ресурсов;
- используется doctor для drift checks.

`baseline.yaml` не даёт ownership. Baseline-only файлы не удаляются через `opm remove`.

Пример:

```yaml
schema: opencode-packman/baseline/v1
createdAt: 2026-04-24T12:00:00.000Z
files:
  opencode.json:
    checksum: sha256:...
```

## Поведение `opm init`

`opm init`:

- создаёт `opencode.json`, если отсутствует;
- создаёт `.opencode/agents`, `.opencode/commands`, `.opencode/skills`, если отсутствуют;
- создаёт `.opencode-packman/lock.yaml` и `.opencode-packman/baseline.yaml`, если отсутствуют;
- не перезаписывает существующие файлы;
- не устанавливает default packages/default skills;
- не добавляет в lockfile ничего, что не установлено через `opm install`.
