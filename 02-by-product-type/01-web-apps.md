# Веб-приложения и сайты (Next.js / React / Node)

> Уверенность: **H** для фактов из официальных документов и advisories; **M** для приоритизации.
> Пример применения: Remainder (дата-сайт по RWA perps) — в основном публичные данные + аккаунты/вотчлисты/API-ключи.

## Что важно
1. **Авторизация на сервере, а не в middleware/UI.** CVE-2025-29927: в Next.js заголовок `x-middleware-subrequest` позволял обойти middleware; патчи — 14.2.25 и 15.2.3 ([Vercel postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass); [GHSA](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw)). Урок: проверка прав должна быть рядом с доступом к данным — Next.js сам рекомендует **Data Access Layer** и `server-only` ([Next.js data security](https://nextjs.org/docs/app/guides/data-security)).
2. **Быстро обновлять фреймворк.** CVE-2025-55182 в React Server Components — неаутентифицированный RCE, CVSS 10.0, версии 19.0–19.2.0 ([React blog](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)). Dependabot/Renovate + быстрый деплой = защита.
3. **Cookies сессии**: `HttpOnly`, `Secure`, `SameSite=Lax/Strict` ([MDN Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies); [SameSite explained](https://web.dev/articles/samesite-cookies-explained); [OWASP Session Mgmt](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)).
4. **CSP и заголовки безопасности** — снижают ущерб от XSS и внедрённых скриптов ([OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html); [Mozilla Web Security](https://infosec.mozilla.org/guidelines/web_security); проверка: [securityheaders.com](https://securityheaders.com/), [CSP Evaluator](https://csp-evaluator.withgoogle.com/)).
5. **Не грузить JS с чужого CDN «на лету» для критичных функций.** Ledger Connect Kit загружал код с CDN в рантайме — вредоносная версия попала во все dApp’ы, использующие loader ([Ledger incident report](https://www.ledger.com/blog/security-incident-report)). Используйте пиннинг версий, lockfile и SRI для внешних скриптов.
6. **CSRF** для cookie-сессий ([PortSwigger CSRF](https://portswigger.net/web-security/csrf)).
7. **Производительность**: Core Web Vitals (LCP, INP, CLS) ([web.dev Vitals](https://web.dev/articles/vitals)). Для дата-сайта: кэш/ISR для публичных страниц, а не запрос в БД на каждый просмотр.
8. **Платформенные настройки** (Vercel): защита preview-деплоев, переменные окружения по средам ([Vercel security](https://vercel.com/docs/security)).
9. **Express/Node best practices**: helmet, ограничение размера тела, не раскрывать stack trace ([Express security](https://expressjs.com/en/advanced/best-practice-security.html); [Node.js security](https://nodejs.org/en/learn/getting-started/security-best-practices)).

## Особенности для крипто-фронтенда
- Фронтенд — часть периметра безопасности: DNS-хайджек Curve (2022), инъекция через Cloudflare/скрипт у BadgerDAO, Ledger Connect Kit — см. `05-security-mistakes/06-crypto-hack-postmortems.md`.
- Показывать пользователю человекочитаемое описание подписи (EIP-712), никогда не просить «blind sign» ([EIP-712](https://eips.ethereum.org/EIPS/eip-712)).
- Регистратор домена: блокировка трансфера (registry lock), 2FA, DNSSEC — **M** (общая практика; конкретных требований в проверенных источниках не найдено).

## Что делать / чего не делать

**Делать**
- Проверять права в каждом server action / route handler через общий DAL (`assertCanAccess(user, resource)`).
- Включить автообновления зависимостей и деплоить security-патчи в течение дней, не недель.
- Ставить CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`.
- Кэшировать публичные данные (ISR/CDN), лимитировать дорогие API-роуты.

**Не делать**
- Не полагаться только на middleware для авторизации.
- Не передавать секреты в клиентский бандл (`NEXT_PUBLIC_*` — публично!).
- Не подключать сторонние скрипты без пиннинга версии/SRI на страницах, где подписываются транзакции.
