# Документ для старта проекта `opencode-packman`

Если разработка будет идти через OpenCode, кладите этот документ в корень как `AGENTS.md`.

---

# Назначение проекта

`opencode-packman` — локальный менеджер пакетов для OpenCode.

Цель: позволить устанавливать заранее подготовленные OpenCode-пакеты в проектную конфигурацию.

Пакет может содержать:

- agents
- commands
- skills
- opencode.json patches

---

# Текущее состояние проекта

Реализован полный MVP:

| Функция                  | Статус |
| ------------------------ | ------ |
| Чтение локального пакета | ✓      |
| Валидация package.yaml   | ✓      |
| Построение install plan  | ✓      |
| Preview/diff             | ✓      |
| Установка пакета         | ✓      |
| Патч opencode.json       | ✓      |
| Запись lockfile          | ✓      |
| Удаление пакета          | ✓      |
| Doctor checks            | ✓      |
| CLI commands             | ✓      |
| Локальные реестры        | ✓      |
| Поиск пакетов            | ✓      |
| Scaffold пакетов         | ✓      |

---

# Структура кода

```
apps/cli/           — CLI (Commander)
  commands/
    init.ts
    create.ts
    preview.ts
    install.ts
    remove.ts
    doctor.ts
    registry.ts
    search.ts

packages/core/     — бизнес-логика
  package/
    packageSchema.ts   — Zod схемы
    packageLoader.ts  — загрузка package.yaml
    packageValidator.ts — валидация

  project/
    projectPaths.ts   — пути проекта
    opencodeConfig.ts — работа с opencode.json

  plan/
    installPlan.ts   — типы install plan
    planBuilder.ts  — построение плана
    conflictDetector.ts — конфликты

  install/
    installer.ts   — установка
    fileActions.ts — копирование файлов
    jsonPatch.ts  — deep merge patch

  lock/
    lockSchema.ts  — Zod схемы lockfile
    lockfile.ts   — чтение/запись lockfile
    ownership.ts  — отслеживание владения

  remove/
    remover.ts    — удаление пакета

  doctor/
    doctor.ts    — главный doctor
    checks.ts    — проверки

  registry/
    registryConfig.ts
    registryPackages.ts
    registryResolver.ts
    registrySchema.ts

  utils/
    fs.ts, yaml.ts, errors.ts, pathSafety.ts
```

---

# CLI команды

Главный binary: `opm`

```bash
opm init                    # создать layout проекта
opm preview <ref>           # показать план установки
opm install <ref> [--yes]   # установить пакет
opm remove <name> [--yes]   # удалить пакет
opm doctor                  # проверить здоровье
opm registry add <name> <path>
opm registry list
opm registry packages <name>
opm search [query]
opm create package <name> [--type bundle|skill|agent|command]
```

`ref` может быть:

- Прямой путь к папке: `./my-package`
- Реестр ссылка: `personal/backend-review`

---

# Workflow разработки

```bash
# установка зависимостей
pnpm install

# сборка
pnpm build

# тесты
pnpm test

# линт
pnpm lint

# smoke test
pnpm smoke
```

---

# Тесты покрывают

- Загрузка валидного пакета
- Отклонение пакета без package.yaml
- Отсутствующий export path
- Построение install plan
- Обнаружение add конфликта
- Deep merge JSON patch
- Запись lockfile
- Doctor обнаруживает отсутствующий SKILL.md
- Remove удаляет owned files

---

# Ограничения MVP

Не реализовано:

- Rollback JSON patches автоматически
- Dependency resolution
- Remote registry

См. `docs/plans/mvp-limitations.md`.

---

# Roadmap

См. `docs/plans/roadmap.md`.

---

# Документация

| Файл                               | Описание                  |
| ---------------------------------- | ------------------------- |
| `README.md`                        | Обзор проекта             |
| `docs/meta/init.md`                | Этот документ             |
| `docs/reference/package-format.md` | Формат пакета             |
| `docs/guides/cli.md`               | CLI справка               |
| `docs/reference/lockfile.md`       | Формат lockfile           |
| `docs/reference/resource-model.md` | Resource model и baseline |
| `docs/plans/mvp-limitations.md`    | Ограничения               |
| `docs/plans/roadmap.md`            | План развития             |

---

# Примеры

Пример пакета: `examples/packages/backend-review/`

```bash
# полный workflow в пустом проекте
mkdir /tmp/my-project
cd /tmp/my-project

opm init
opm preview /path/to/packman/examples/packages/backend-review
opm install /path/to/packman/examples/packages/backend-review --yes
opm doctor
opm remove backend-review --yes
```

---

# Правила разработки

- Предпочитать маленькие файлы
- Предпочитать чистые функции в core
- CLI должен быть тонким
- Бизнес-логика в `packages/core`
- Сначала тесты для core
- Не хардкодить абсолютные пути
- Не требовать OpenCode binary
- Все операции с файлами явные и безопасные
- Никогда не удалять файлы без ownership в lockfile
- Всегда показывать preview перед разрушительными операциями

Безопасность:

- Проверять path traversal
- Нормализовать пути перед сравнением
- Держать записи в пределах project root
