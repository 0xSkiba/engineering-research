# SRE: SLO, error budgets, postmortems, наблюдаемость

> Уверенность: **H** (Google SRE book/workbook, Stripe, OpenTelemetry).

## SLO и error budget
- 100% надёжность — неправильная цель: пользователь на смартфоне с 99% надёжностью не отличит 99.99% от 99.999% ([SRE book: Embracing Risk](https://sre.google/sre-book/embracing-risk/)).
- SLI → SLO → (опционально) SLA ([Service Level Objectives](https://sre.google/sre-book/service-level-objectives/); [Implementing SLOs](https://sre.google/workbook/implementing-slos/)).
- **Error budget policy (пример Google)**: если бюджет за 4 недели исчерпан — заморозка изменений кроме P0/безопасности; если один инцидент съел >20% бюджета — обязателен postmortem ([Error Budget Policy](https://sre.google/workbook/error-budget-policy/)).
- Алертинг по SLO через burn rate ([Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)).

## Мониторинг и наблюдаемость
- **Четыре золотых сигнала**: latency, traffic, errors, saturation ([Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)).
- **Canonical log lines (Stripe)**: в конце каждого запроса — одна широкая строка лога со всеми ключевыми полями ([Stripe](https://stripe.com/blog/canonical-log-lines)).
- **Трассировка**: Google Dapper ([research](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/)); сегодня стандарт — OpenTelemetry ([Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)).
- AWS: инструментирование и метрики на каждый запрос ([Instrumenting distributed systems](https://aws.amazon.com/builders-library/instrumenting-distributed-systems-for-operational-visibility/)).
- **Алерты должны быть действиями.** Урок Knight Capital: 97 автоматических писем об ошибке пришли до открытия рынка, но не были спроектированы как алерты и были проигнорированы ([SEC](https://www.sec.gov/newsroom/press-releases/2013-222)).

## Устойчивость к перегрузке
- Таймауты, ретраи с экспоненциальным backoff **и jitter** ([AWS: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/); [Marc Brooker: Jitter](https://brooker.co.za/blog/2015/03/21/backoff.html)).
- Ретраи безопасны только для идемпотентных операций ([AWS: idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/); [Stripe: idempotency](https://stripe.com/blog/idempotency)).
- Load shedding: отбрасывать менее важный трафик, сохраняя критичный ([AWS](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/); [Stripe rate limiters & load shedders](https://stripe.com/blog/rate-limiters); [SRE: Handling Overload](https://sre.google/sre-book/handling-overload/); [Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)).
- Изоляция: cells и shuffle sharding ([AWS shuffle-sharding](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)); static stability ([AWS](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/)); избегать «fallback»-путей, которые не тестируются ([AWS](https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/)).
- Chaos engineering: Netflix Chaos Monkey ([netflix.github.io/chaosmonkey](https://netflix.github.io/chaosmonkey/)). Для соло — достаточно периодически «ронять» зависимость на staging.

## Postmortems и blameless-культура
- Blameless postmortem фокусируется на системных причинах, а не на людях; «You can’t "fix" people, but you can fix systems» ([SRE book: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/); [workbook](https://sre.google/workbook/postmortem-culture/)). Atlassian — практическое руководство ([blameless](https://www.atlassian.com/incident-management/postmortem/blameless)).
- Управление инцидентом: роли, коммуникация ([Managing Incidents](https://sre.google/sre-book/managing-incidents/)).
- Хорошие публичные примеры: GitLab 2017 ([postmortem](https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/)), GitHub 2018 ([Oct 21 analysis](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)), AWS S3 2017 ([summary](https://aws.amazon.com/message/41926/)), Cloudflare ([2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/), [2025](https://blog.cloudflare.com/18-november-2025-outage/)), Slack 2021 ([outage](https://slack.engineering/slacks-outage-on-january-4th-2021/)), Atlassian 2022 ([PIR](https://www.atlassian.com/engineering/post-incident-review-april-2022-outage)). Разбор — в `03-anti-patterns-and-beginner-mistakes/01-incident-catalog.md`.

## Шаблон мини-postmortem для соло (в `docs/postmortems/YYYY-MM-DD-*.md`)
```
## Что произошло (таймлайн, UTC)
## Влияние (кто, сколько, как долго; данные/деньги?)
## Причины (технические + процессные; без поиска виноватых)
## Что сработало / что нет (алерты, откат, бэкап)
## Действия (владелец, срок) — минимум одно, предотвращающее класс ошибок
## Правило для AGENTS.md (если применимо)
```

## Что делать / чего не делать

**Делать**
- Определить 2–3 SLO (например: доступность API 99.5%, p95 латентность, свежесть данных ≤ N минут для дата-сайта).
- Логировать каждый запрос одной структурированной строкой с request_id, user_id/tenant_id, latency, status.
- Таймауты на всех внешних вызовах; ретраи только идемпотентных операций, с jitter.
- Писать короткий postmortem после любого инцидента и превращать выводы в правила/тесты.

**Не делать**
- Не ставить цель «100% аптайм».
- Не слать «информационные» письма/сообщения вместо алертов — их не читают.
- Не ретраить без ограничения (retry storm) и без jitter.
