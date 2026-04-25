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

- `opencode.json` (наличие, валидность);
- `.opencode` (наличие директории);
- `lock.yaml` (наличие, baseline);
- `baseline.yaml` (наличие, изменения baseline files);
- locked targets (наличие всех owned files и директорий);
- locked skills (наличие `SKILL.md` в skill директориях);
- ownership consistency (нет пакетов без owned targets);
- locked integrity (контрольные суммы installed files — обнаружение ручных изменений).

#### Коды проблем doctor

| Код | Тип | Описание |
|-----|-----|----------|
| `missing_opencode_json` | warning | `opencode.json` отсутствует |
| `invalid_opencode_json` | broken | `opencode.json` содержит невалидный JSON |
| `missing_opencode_dir` | warning | директория `.opencode` отсутствует |
| `missing_lockfile` | warning | `lock.yaml` отсутствует |
| `missing_baseline` | warning | `baseline.yaml` отсутствует |
| `baseline_file_modified` | warning | baseline file изменён после `opm init` |
| `baseline_file_missing` | warning | baseline file удалён |
| `missing_locked_target` | broken | owned file или директория пакета не найдены |
| `missing_skill_file` | broken | в skill директории отсутствует `SKILL.md` |
| `package_has_no_owned_targets` | warning | пакет в lockfile не владеет ни одним файлом |
| `locked_target_modified` | warning | installed file изменён вручную после установки |
| `locked_target_checksum_error` | warning | не удалось прочитать checksum установленного file |

`locked_target_modified` появляется только для файлов, чья checksum была записана в lockfile во время `opm install`.

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

### `opm package create <name>`

Создаёт package scaffold (domain style).

```
--type <type>      skill|agent|command|bundle|profile (default: bundle)
--dir <path>       Parent directory
--registry <name>  Create inside registry path
--force            Allow non-empty target directory
```

### `opm package validate <packageRef>`

Загружает пакет и запускает полную валидацию:

- проверяет `package.yaml`;
- проверяет наличие и содержимое всех export paths;
- проверяет SKILL.md frontmatter для skill exports;
- выводит errors и warnings.

Завершается с exit code 1, если есть ошибки.

### `opm package inspect <packageRef>`

Показывает содержимое манифеста пакета:

- name, version, type, description;
- сводка по exports (agents, commands, skills, config patches);
- абсолютный путь;
- metadata (author, license, tags) — если задано;
- compatibility.opencode — если задано;
- env.required / env.optional — если заданы;
- risk.level — если задан.

### `opm package publish <packagePath> --registry <name>`

Публикует пакет в локальный реестр:

- валидирует пакет перед копированием;
- копирует в `<registry.path>/packages/<name>`;
- записывает `.opm/published.yaml` с метаданными (registry, packageName, version, publishedAt, sourcePath).

```
--registry <name>  Target registry name (required)
--force            Overwrite if package already exists
--as <name>        Publish under a different name
```

### `opm preview <packageRef>`

Строит install plan и показывает preview без изменений на диске.

### `opm install <packageRef> [--yes] [--dry-run]`

Устанавливает пакет в проект и обновляет `lock.yaml`.

При установке для каждого скопированного файла и директории вычисляется SHA-256 checksum и сохраняется в lockfile. Эти checksums используются `opm doctor` для обнаружения ручных изменений (`locked_target_modified`).

### `opm remove <packageName> [--yes] [--dry-run]`

Удаляет только owned targets из `lock.yaml`.

## Registry commands

Реестр хранится в `~/.opencode-packman/registries.yaml`.

- `opm registry add <name> <path> [--force]`
- `opm registry list`
- `opm registry remove <name>`
- `opm registry packages <name>`
- `opm search [query] [--tag <tag>] [--type <type>]`

`opm search` опции:

```
--tag <tag>    Фильтр по тегу (точное совпадение в массиве tags)
--type <type>  Фильтр по типу: skill|agent|command|bundle|profile
```

Поиск работает по: packageName, description, type и tags.

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
