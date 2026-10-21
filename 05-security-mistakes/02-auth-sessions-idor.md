# Аутентификация, сессии, IDOR/BOLA, гонки

> Уверенность: **H** (OWASP, NIST, IETF, PortSwigger).

## Аутентификация
- **Не писать свою.** Использовать проверенную библиотеку/провайдера; пароли — Argon2id/scrypt/bcrypt ([OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- **Правила паролей по NIST 800-63B**: без правил состава и без периодической смены; проверка по blocklist скомпрометированных паролей ([NIST 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)); например, k-anonymity API Pwned Passwords ([HIBP API](https://haveibeenpwned.com/API/v3); [Troy Hunt](https://www.troyhunt.com/ive-just-launched-pwned-passwords-version-2/)).
- **MFA/passkeys**: WebAuthn/passkeys устойчивы к фишингу ([passkeys.dev](https://passkeys.dev/); [WebAuthn L3](https://www.w3.org/TR/webauthn-3/); [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)).
- **Лимиты на логин/восстановление** по аккаунту И по IP/подсети (credential stuffing идёт с многих IP) ([OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html); [Cloudflare ATO](https://blog.cloudflare.com/account-takeover-protection/); [Google Cloud: credential stuffing](https://cloud.google.com/blog/products/identity-security/how-google-protects-against-credential-stuffing)).
- **OAuth 2.0**: PKCE, точные redirect URI, никаких implicit flows ([RFC 9700 — OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html)).

## Сессии и токены
- Серверные сессии в cookie `HttpOnly; Secure; SameSite`, ротация ID при логине, инвалидация при выходе и смене пароля ([OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)).
- **JWT**: фиксировать алгоритм (никакого `alg: none`), проверять `exp/aud/iss`, короткий срок, ключи с ротацией ([RFC 8725 JWT BCP](https://datatracker.ietf.org/doc/html/rfc8725); [Auth0: уязвимости JWT-библиотек](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/); [jwt.io](https://jwt.io/introduction)). JWT нельзя «отозвать» без серверного состояния — для веб-приложения обычно проще серверные сессии (**M**).
- **Кража сессий обходит 2FA**: CircleCI — малварь на ноутбуке инженера украла валидную SSO-сессию с 2FA ([CircleCI](https://circleci.com/blog/jan-4-2023-incident-report/)); Ledger — фишинг сессионного токена npm бывшего сотрудника ([Ledger](https://www.ledger.com/blog/security-incident-report)). Короткие сессии для привилегированных действий + повторная аутентификация.
- **Offboarding**: у Ledger доступ бывшего сотрудника к npm не был отозван (там же). Для соло: регулярно ревьюить токены, OAuth-приложения ([GitHub: украденные OAuth-токены Heroku/Travis](https://github.blog/2022-04-15-security-alert-stolen-oauth-user-tokens/)).

## IDOR / BOLA — №1 в API
- Определение и примеры: [PortSwigger IDOR](https://portswigger.net/web-security/access-control/idor); [OWASP API1 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
- Шаблон защиты: каждый запрос к объекту = `WHERE id = $1 AND tenant_id = $2` (или `owner_id`) + RLS как второй рубеж. Возвращать 404 (а не 403), чтобы не подтверждать существование чужих объектов (**M**, общая практика).
- **Function-level** (API5): админ-функции — отдельные роуты с проверкой роли на сервере.
- **Property-level** (API3 / mass assignment): allowlist полей ([OWASP Mass Assignment](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)).
- Тест: для каждого эндпоинта — тест «пользователь B получает 404 на объект A». Пример: `examples/api/idor-safe-handler.ts`.

## Гонки (race conditions)
- Лимиты «одна награда на пользователя», «баланс ≥ суммы», одноразовые коды — ломаются параллельными запросами ([PortSwigger race conditions](https://portswigger.net/web-security/race-conditions); [Smashing the state machine](https://portswigger.net/research/smashing-the-state-machine)).
- Решения: атомарные `UPDATE ... WHERE balance >= $amt RETURNING`, уникальные индексы, `SELECT ... FOR UPDATE`, идемпотентные ключи.

## CSRF
- Для cookie-сессий: SameSite + CSRF-токен на изменяющих запросах ([PortSwigger CSRF](https://portswigger.net/web-security/csrf)).

## Что делать / чего не делать

**Делать**
- Использовать готовую auth-библиотеку/провайдера; passkeys/MFA для админа.
- Проверять владельца/tenant в каждом запросе к БД + RLS.
- Тест на IDOR для каждого нового эндпоинта.
- Атомарные операции для балансов, лимитов, одноразовых действий.
- Повторная аутентификация для чувствительных действий (смена email, вывод, API-ключи).

**Не делать**
- Не хранить токены в `localStorage`, если можно HttpOnly-cookie.
- Не доверять `userId`/`role`/`tenantId` из тела запроса или JWT без проверки подписи.
- Не делать «проверить → потом обновить» двумя запросами без блокировки.
