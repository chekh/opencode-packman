# CLI Reference

См. также `docs/resource-model.md` для модели состояния проекта.

## Project commands

### `opm project init`

Инициализирует project state:

- создаёт `opencode.json`, если отсутствует;
- создаёт `.opencode/agents`, `.opencode/commands`, `.opencode/skills`;
- создаёт `.opencode-packman/lock.yaml` (пустой);
- создаёт `.opencode-packman/baseline.yaml`.

Существующие файлы не перезаписываются.

### `opm project doctor`

Проверяет:

- `opencode.json`;
- `.opencode`;
- `lock.yaml`;
- `baseline.yaml`;
- locked targets;
- locked skills;
- ownership consistency.

### `opm project status`

Показывает сводку project state:

- наличие `opencode.json` и `.opencode/`;
- состояние `lock.yaml` и `baseline.yaml`;
- количество установленных пакетов;
- количество baseline files;
- итоговый статус doctor.

### `opm project installed`

Выводит список пакетов, установленных в текущем проекте:

- имя пакета;
- версия;
- source path;
- scope;
- дата установки.

Если пакетов нет, выводит `No packages installed.`

## Package commands

### `opm create package <name>`

Создаёт package scaffold.

### `opm preview <packageRef>`

Строит install plan и показывает preview без изменений на диске.

### `opm install <packageRef> [--yes] [--dry-run]`

Устанавливает пакет в проект и обновляет `lock.yaml`.

### `opm remove <packageName> [--yes] [--dry-run]`

Удаляет только owned targets из `lock.yaml`.

## Registry commands

Реестр хранится в `~/.opencode-packman/registries.yaml`.

- `opm registry add <name> <path> [--force]`
- `opm registry list`
- `opm registry remove <name>`
- `opm registry packages <name>`
- `opm search [query]`

## Config commands

### `opm config paths`

Показывает:

- project paths (`opencode.json`, `.opencode`, `.opencode-packman`, `lock.yaml`, `baseline.yaml`);
- user config paths (`~/.opencode-packman`, `registries.yaml`);
- список registry aliases и их пути.

Если реестров нет, выводится `none`.

## Short aliases

Доменные команды имеют короткие алиасы:

- `opm init` -> `opm project init`
- `opm doctor` -> `opm project doctor`
- `opm preview` -> `opm package preview` (domain style planned)
- `opm install` -> `opm package install` (domain style planned)
- `opm remove` -> `opm package remove` (domain style planned)
- `opm search` -> `opm package search` (domain style planned)
