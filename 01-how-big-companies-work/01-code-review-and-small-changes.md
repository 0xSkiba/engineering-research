# Code review и маленькие изменения

> Уровень уверенности: **H** — первоисточники Google (SWE book, eng-practices), Meta, GitHub.
> Аудитория: соло-разработчик + AI-агенты. «Ревьюер» у вас — это вы сами, второй агент и автоматические проверки.

## Как это делают большие компании

### Google
- **Ревью почти каждого изменения.** В Google «essentially every change is reviewed before being committed» — книга *Software Engineering at Google*, гл. 9 ([SWE book ch.9](https://abseil.io/resources/swe-book/html/ch09.html)).
- **Три «бита» разрешения**: LGTM от коллеги (корректность), одобрение владельца каталога (OWNERS) и readability (стиль языка). По умолчанию достаточно одного LGTM ([ch.9](https://abseil.io/resources/swe-book/html/ch09.html)).
- **Маленькие изменения.** Ревьюер вправе отклонить изменение как «too large for a single review» ([ch.9](https://abseil.io/resources/swe-book/html/ch09.html); [Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)).
- **Стандарт ревью**: одобрять, если изменение *улучшает общее здоровье кода*, даже если оно не идеально ([The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)).
- Исследование Google о ревью: [Modern Code Review: A Case Study at Google](https://research.google/pubs/modern-code-review-a-case-study-at-google/) (прочитана аннотация).

### Meta
- Meta измеряла время ожидания ревью и строила инструменты, чтобы его сокращать ([Move faster, wait less](https://engineering.fb.com/2022/11/16/culture/meta-code-review-time-improving/)). Мысль для вас: долгий «висящий» PR — это тоже риск (конфликты, устаревший контекст).

### GitHub
- GitHub выкатывает сотни изменений в день через **merge queue**: PR проходят CI поверх актуального main перед слиянием ([How GitHub uses merge queue](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/)).
- Shopify описывала аналогичную проблему «1000+ разработчиков в одном монолите» и свой merge-процесс ([Successfully Merging the Work of 1000+ Developers](https://shopify.engineering/successfully-merging-work-1000-developers)).

### Статический анализ как «бесплатный ревьюер»
- Google встраивает статанализ прямо в ревью (Tricorder), показывая находки как комментарии ([SWE book ch.20](https://abseil.io/resources/swe-book/html/ch20.html)). Для вас аналог — ESLint/tsc strict/Semgrep/Slither в CI + pre-commit.

## Перенос на соло + AI-агентов

| Практика больших компаний | Ваш эквивалент |
|---|---|
| LGTM от второго инженера | Второй агент (или новая сессия) делает ревью диффа с чек-листом из `07-checklists/` |
| OWNERS | `CODEOWNERS` + правило в AGENTS.md: «не трогать `contracts/`, `migrations/`, `auth/` без явной задачи» |
| Readability | Линтер + форматтер + `tsc --strict` блокируют merge |
| Small CLs | Агенту: «один PR = одна логическая задача, ≤ ~400 строк диффа» (порог — эвристика, **L**) |
| Merge queue | Branch protection: required checks на актуальном main |

## Что делать / чего не делать

**Делать**
- Требовать от агента маленькие, атомарные PR с описанием «зачем» и «как проверено».
- Ревьюить дифф *перед* merge, особенно файлы: auth, миграции, контракты, конфиги CI, `.env*`, зависимости.
- Автоматизировать всё, что может проверить машина (типы, линт, тесты, секрет-сканер), чтобы человек смотрел на логику и безопасность.
- Включить branch protection и required status checks даже в соло-репо.

**Не делать**
- Не принимать «мега-PR» от агента на тысячи строк — просить разбить.
- Не мержить, если CI красный «потому что флейки» — сначала чинить или изолировать тест.
- Не позволять агенту одновременно менять код и тесты, которые этот код проверяют, без вашего взгляда на тесты.
