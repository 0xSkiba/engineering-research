# Секреты, SSRF, инъекции, неправильно настроенное облако

> Уверенность: **H**.

## Секреты в репозиториях и логах
- GitGuardian (2026): 29 млн секретов попали в публичный GitHub за год; утечки ключей AI-сервисов выросли на 81% ([State of Secrets Sprawl 2026](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/)).
- Uber 2016: креды AWS из приватного GitHub-репозитория → данные 57 млн ([TechCrunch](https://techcrunch.com/2017/11/21/uber-data-breach-from-2016-affected-57-million-riders-and-drivers/)). Microsoft 2023: SAS-токен в публичном репо → 38 TB ([Wiz](https://www.wiz.io/blog/38-terabytes-of-private-data-accidentally-exposed-by-microsoft-ai-researchers)). DeepSeek 2025: секретные ключи в логах открытой БД ([Wiz](https://www.wiz.io/blog/wiz-research-uncovers-exposed-deepseek-database-leak)).
- Меры: секрет-менеджер, переменные окружения, короткоживущие токены, OIDC вместо статических ключей в CI ([OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html); [12factor config](https://12factor.net/config)); сканеры — pre-commit + CI + push protection ([gitleaks](https://github.com/gitleaks/gitleaks), [trufflehog](https://github.com/trufflesecurity/trufflehog), [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)).
- **Утёк — значит ротировать.** Удаление из истории git не помогает: секрет уже мог быть скопирован (CISA про tj-actions: «Rotate all identified secrets immediately» — [CISA](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-tj-actionschanged-files-cve-2025-30066-and-reviewdogaction)).
- Не логировать секреты/токены/PII ([OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

## SSRF
- Сервер делает запрос по URL пользователя → доступ к внутренним сервисам и метаданным облака ([PortSwigger SSRF](https://portswigger.net/web-security/ssrf); [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).
- Capital One 2019: через неверно настроенный WAF запросы ушли к сервису метаданных AWS ([Krebs](https://krebsonsecurity.com/2019/08/what-we-can-learn-from-the-capital-one-hack/); [Capital One](https://www.capitalone.com/digital/facts2019/)).
- Защита: allowlist доменов; резолвить DNS и запрещать приватные/loopback/link-local адреса (включая `169.254.169.254`) **после** резолва и на каждом редиректе; IMDSv2; минимальные IAM-права. Пример: `examples/api/ssrf-guard.ts`.
- Для крипто-дата-сайта типичные SSRF-точки: «добавьте свой RPC URL», вебхуки, превью ссылок, импорт по URL.

## Инъекции
- SQL: только параметры / query builder; динамические имена колонок/сортировки — через allowlist ([OWASP SQLi Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html); [PortSwigger SQLi](https://portswigger.net/web-security/sql-injection)). В Prisma `$queryRawUnsafe` с интерполяцией — опасно ([Prisma docs](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)); в Drizzle `sql` с шаблоном параметризует значения ([Drizzle](https://orm.drizzle.team/docs/sql)).
- Команды ОС: никакого `exec(\`... ${input}\`)`; `execFile` с массивом аргументов.
- **Инъекции в CI**: `${{ github.event.issue.title }}` прямо в `run:` — инъекция в шелл; пример Ultralytics (атака через кэш GitHub Actions и неотозванный API-токен PyPI) ([PyPI blog](https://blog.pypi.org/posts/2024-12-11-ultralytics-attack-analysis/); [GitHub Security Lab: pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/)).
- Prompt injection для LLM-фич: недоверенный текст не должен управлять инструментами ([OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/)).

## Неправильно настроенное облако и хранилища
- S3: включить Block Public Access на уровне аккаунта ([AWS docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)); история утечек через открытые бакеты — напр., Accenture ([UpGuard](https://www.upguard.com/breaches/cloud-leak-accenture); [UpGuard: S3 security](https://www.upguard.com/blog/s3-security-is-flawed-by-design)).
- БД/Redis/ClickHouse/Mongo — не в публичной сети ([MongoDB security checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/); DeepSeek выше).
- Postgres: не использовать `trust`-аутентификацию по TCP ([Postgres wiki](https://wiki.postgresql.org/wiki/Don%27t_Do_This)).
- Supabase: RLS на каждой таблице exposed-схемы; `service_role` ключ — только на сервере ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Что делать / чего не делать

**Делать**
- Секрет-сканер в pre-commit и CI; push protection на GitHub.
- OIDC/короткоживущие креды для CI и облака.
- SSRF-фильтр для любого исходящего запроса по пользовательскому URL.
- Параметризованный SQL везде; allowlist для динамических идентификаторов.
- Block Public Access и приватные сети для всех хранилищ.

**Не делать**
- Не коммитить `.env`, ключи, дампы БД; не вставлять секреты в промпты агентам.
- Не «чистить историю» вместо ротации утёкшего ключа.
- Не интерполировать данные событий GitHub в `run:` шаги.
