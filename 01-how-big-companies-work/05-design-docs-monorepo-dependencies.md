# Design docs / RFC, монорепо, зависимости

> Уверенность: **H** для фактов из источников; **M** для рекомендаций по адаптации.

## Design docs (Google)
- Структура: context & scope, goals & non-goals, дизайн, **alternatives considered**, cross-cutting concerns (безопасность, приватность, наблюдаемость) ([Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/); также [Google Cloud blog](https://cloud.google.com/blog/products/devops-sre/how-google-does-design-docs)).
- Размер: для крупного проекта «10-20ish pages», но допустим «mini design doc» на 1–3 страницы (там же).
- Если в доке нет компромиссов и альтернатив — вероятно, лучше было сразу писать код (там же).

**Для работы с агентами design doc — лучший промпт**: агент получает цели, не-цели, ограничения и критерии приёмки. Храните в `docs/design/NNNN-title.md`.

## Монорепо и «one version»
- Google хранит код в одном репозитории ([Why Google Stores Billions of Lines of Code in a Single Repository](https://research.google/pubs/why-google-stores-billions-of-lines-of-code-in-a-single-repository/), прочитана аннотация).
- Политика «одной версии» зависимостей и trunk-based разработки ([SWE book ch.16](https://abseil.io/resources/swe-book/html/ch16.html)); управление зависимостями ([ch.21](https://abseil.io/resources/swe-book/html/ch21.html)); крупномасштабные изменения ([ch.22](https://abseil.io/resources/swe-book/html/ch22.html)).
- Shopify держит большой Rails-монолит и делит его на компоненты с проверяемыми границами, а не на микросервисы ([Deconstructing the Monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity); [Under Deconstruction](https://shopify.engineering/shopify-monolith)).
- Martin Fowler о цене микросервисов ([Microservice Trade-Offs](https://martinfowler.com/articles/microservice-trade-offs.html)) и о постепенной замене через Strangler Fig ([bliki](https://martinfowler.com/bliki/StranglerFigApplication.html)).

**Вывод для соло**: модульный монолит в одном репо (pnpm/npm workspaces: `apps/web`, `apps/api`, `packages/db`, `contracts/`) — проще всего для агентов (весь контекст рядом) и для атомарных изменений. Микросервисы — только при явной причине (разные требования к масштабу/изоляции).

## 12-factor
- Конфигурация в окружении, а не в коде ([12factor: Config](https://12factor.net/config); [12factor.net](https://12factor.net/)).

## ADR (Architecture Decision Records)
- Короткие записи «решение — контекст — последствия» в `docs/adr/`. Это не из Google-источника, а распространённая практика (**M**); полезна агентам, чтобы не «переизобретать» уже отвергнутые решения.

## Что делать / чего не делать

**Делать**
- Перед крупной задачей писать mini design doc (1–2 страницы) и давать его агенту.
- Явно перечислять non-goals — агенты склонны «доделывать лишнее».
- Держать одну версию каждой зависимости в монорепо; lockfile в git.
- Фиксировать архитектурные решения в ADR и ссылаться на них из AGENTS.md.

**Не делать**
- Не дробить на микросервисы «как у Netflix» без нагрузки и команды Netflix.
- Не хранить конфиг/секреты в коде.
- Не начинать большую фичу с «напиши всё» — сначала дизайн, потом маленькие PR.
