# Тестирование и CI

> Уверенность: **H** (Google SWE book гл. 11–14, 23; DORA).

## Ключевые идеи из первоисточников

- **Почему тесты — не роскошь.** История Google Web Server: в какой-то момент «more than 80% of production pushes» содержали баги, требовавшие отката; ситуацию переломили автотесты ([SWE book ch.11](https://abseil.io/resources/swe-book/html/ch11.html)).
- **Размер теста ≠ «unit/integration».** Google делит тесты на small/medium/large по ресурсам: small — один процесс, без сна и I/O; это делает их быстрыми и детерминированными ([ch.11](https://abseil.io/resources/swe-book/html/ch11.html)). Подробнее: юнит-тесты ([ch.12](https://abseil.io/resources/swe-book/html/ch12.html)), test doubles ([ch.13](https://abseil.io/resources/swe-book/html/ch13.html)), larger tests ([ch.14](https://abseil.io/resources/swe-book/html/ch14.html)).
- **Флейки-тесты разрушают доверие к CI** — Google подробно разбирает их цену в гл. 11 и 23 ([ch.23 CI](https://abseil.io/resources/swe-book/html/ch23.html)).
- **CI = быстрый сигнал на каждое изменение**, presubmit + post-submit ([ch.23](https://abseil.io/resources/swe-book/html/ch23.html)); **CD** — выпуск маленькими частями часто ([ch.24](https://abseil.io/resources/swe-book/html/ch24.html)).
- **Trunk-based development** — одна главная ветка, без долгоживущих dev-веток; Google называет это «particularly scalable» ([ch.16](https://abseil.io/resources/swe-book/html/ch16.html); [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/)).
- **DORA**: метрики доставки — частота деплоев, lead time, change fail rate, время восстановления ([DORA metrics](https://dora.dev/guides/dora-metrics-four-keys/)).
- **GitHub** гоняет CI GitHub.com на больших раннерах Actions ([GitHub blog](https://github.blog/engineering/infrastructure/how-github-uses-github-actions-and-actions-larger-runners-to-build-and-test-github-com/)); Stripe — о быстрых и безопасных сборках ([Fast builds, secure builds](https://stripe.com/blog/fast-secure-builds-choose-two)).
- **Нагрузочное тестирование перед пиками**: Shopify готовится к BFCM нагрузочными тестами ([Performance Testing At Scale](https://shopify.engineering/scale-performance-testing); [Resiliency Planning](https://shopify.engineering/resiliency-planning-for-high-traffic-events)).

## Минимальный CI для TypeScript/Node + Postgres + контракты

```yaml
# .github/workflows/ci.yml (сокращённо; actions пиновать по SHA)
on: [pull_request]
permissions: { contents: read }
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:17, env: { POSTGRES_PASSWORD: test }, ports: ["5432:5432"] }
    steps:
      - uses: actions/checkout@<SHA>
      - run: npm ci --ignore-scripts      # lockfile обязателен
      - run: npx tsc --noEmit
      - run: npx eslint .
      - run: npm test                      # small tests
      - run: npm run test:integration      # с реальной БД (medium)
      - run: npx gitleaks detect --no-banner   # или аналог
  contracts:
    steps:
      - run: forge test -vvv               # включая fuzz/invariant
      - run: slither . --fail-high
```
Ссылки на инструменты: [Foundry](https://github.com/foundry-rs/foundry), [invariant testing](https://book.getfoundry.sh/forge/invariant-testing), [Slither](https://github.com/crytic/slither), [Echidna](https://github.com/crytic/echidna), [gitleaks](https://github.com/gitleaks/gitleaks), [npm ci](https://docs.npmjs.com/cli/v10/commands/npm-ci).

## Что тестировать в первую очередь (для соло-продукта)
1. **Авторизация на каждом эндпоинте**: тест «пользователь A не видит/не меняет объект B» (см. `05-security-mistakes/02-auth-sessions-idor.md`).
2. **Денежная/ценовая математика**: округления, decimal vs float, граничные значения.
3. **Миграции БД**: прогон up на копии схемы + тест обратной совместимости кода со старой схемой.
4. **Контракты**: unit + fuzz + invariant (например, «сумма балансов = totalSupply»).
5. **Парсинг внешних данных** (биржи, оракулы, API): что будет при пустом ответе, NaN, устаревшем timestamp.

## Что делать / чего не делать

**Делать**
- CI на каждый PR; merge только при зелёном CI.
- Интеграционные тесты против настоящего Postgres в контейнере, а не моков SQL.
- Для контрактов — fuzz и invariant-тесты, а не только happy-path.
- Измерять хотя бы 2 метрики DORA: частоту деплоев и долю неудачных изменений.

**Не делать**
- Не позволять агенту «чинить» красный тест ослаблением assert'а или `skip` без объяснения.
- Не держать долгоживущие ветки неделями — сливать маленькими кусками за флагами.
- Не гнаться за 100% покрытия; покрывать рискованные пути (деньги, доступ, данные).
