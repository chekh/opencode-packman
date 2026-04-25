# opencode-packman

`opencode-packman` — локальный менеджер пакетов для OpenCode.

Позволяет упаковывать агентов, команды, навыки и `opencode.json` патчи, делать preview изменений, устанавливать их в проект, отслеживать владение через lockfile и безопасно удалять установленные пакеты.

## Проблема

OpenCode-ресурсы часто копируются вручную между проектами. `opencode-packman` заменяет это повторяемыми процессами install/remove с отслеживанием владения.

## Quickstart

```bash
# установка зависимостей
pnpm install

# сборка и тесты
pnpm build
pnpm test
pnpm lint
```

### Полный workflow

```bash
# создать пустой проект
mkdir /tmp/my-project
cd /tmp/my-project

# инициализировать layout
pnpm --dir /path/to/opencode-packman dev -- init

# preview пакета
pnpm --dir /path/to/opencode-packman dev -- preview /path/to/opencode-packman/examples/packages/backend-review

# установка
pnpm --dir /path/to/opencode-packman dev -- install /path/to/opencode-packman/examples/packages/backend-review --yes

# проверка здоровья
pnpm --dir /path/to/opencode-packman dev -- doctor

# удаление
pnpm --dir /path/to/opencode-packman dev -- remove backend-review --yes
```

## Что включается в MVP

| Команда | Описание |
|---------|----------|
| `opm init` | Создать layout проекта |
| `opm project status` | Статус project state |
| `opm preview <ref>` | Показать план установки |
| `opm install <ref> [--yes]` | Установить пакет |
| `opm remove <name> [--yes]` | Удалить пакет |
| `opm doctor` | Проверить здоровье |
| `opm registry` | Управление локальными реестрами |
| `opm search [query]` | Поиск по реестрам |
| `opm create package <name>` | Создать шаблон пакета |

### Реализовано

- Загрузка и валидация локальных пакетов (`package.yaml`)
- Preview установки с конфликтами
- Install (копирование файлов, директорий, JSON patch)
- Project и global scope install/remove/doctor/init
- Lockfile (`.opencode-packman/lock.yaml`)
- Baseline (`.opencode-packman/baseline.yaml`)
- Remove по ownership из lockfile
- Doctor checks
- Локальные реестры пакетов
- Поиск пакетов
- Scaffold пакетов

### Не в MVP

- Rollback JSON patches
- Разрешение зависимостей
- UI / marketplace

См. `docs/mvp-limitations.md` для полного списка.

## Структура пакета

```
my-package/
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

См. `docs/package-format.md` для полного формата.

## Lockfile

Lockfile хранит информацию об установленных пакетах и их владении файлами.

Расположение: `.opencode-packman/lock.yaml`

Используется для:
- Отслеживания владения файлами
- Безопасного удаления пакетов
- Конфликтов при установке
- Doctor checks

См. `docs/lockfile.md`.

## Resource model

`opm init` теперь создаёт:

- `opencode.json`, если отсутствует
- `.opencode/agents`, `.opencode/commands`, `.opencode/skills`
- `.opencode-packman/lock.yaml` (пустой installed state)
- `.opencode-packman/baseline.yaml` (snapshot unmanaged OpenCode-файлов)

См. `docs/resource-model.md`.

## CLI справка

См. `docs/cli.md` для всех команд и опций.

## Roadmap

См. `docs/roadmap.md` дл�� плана развития.

## Разработка

```
apps/cli/           — CLI (Commander)
  commands/        — init, preview, install, remove, doctor, registry, create, search

packages/core/     — бизнес-логика
  package/         — загрузка и валидация package.yaml
  project/         — пути проекта, opencode.json
  plan/            — построение install plan, конфликты
  install/         — копирование файлов, JSON patch
  lock/            — lockfile, ownership
  remove/          — удаление пакетов
  doctor/          — проверки здоровья
  registry/        — локальные реестры
```

## Ссылки

- Документация: `docs/package-format.md`, `docs/cli.md`, `docs/lockfile.md`, `docs/resource-model.md`, `docs/roadmap.md`, `docs/mvp-limitations.md`
- Пример пакета: `examples/packages/backend-review/`
- AGENTS.md: `docs/init.md`
