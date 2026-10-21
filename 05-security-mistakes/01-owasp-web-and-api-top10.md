# OWASP Top 10 (2025) и OWASP API Top 10 (2023): карта рисков

> Уверенность: **H** (официальные списки OWASP). Подробные разборы — в соседних файлах.

## OWASP Top 10:2025 ([owasp.org/Top10/2025](https://owasp.org/Top10/2025/))
| # | Категория | Как выглядит у соло-разработчика с агентами | Где подробнее |
|---|---|---|---|
| A01 | Broken Access Control | Эндпоинт по `id` без проверки владельца; админ-роут без проверки роли | `02-auth-sessions-idor.md` |
| A02 | Security Misconfiguration | Открытая БД/бакет, debug в проде, CORS `*` с credentials | `03-secrets-ssrf-injection-cloud.md` |
| A03 | Software Supply Chain Failures | Новый npm-пакет от агента; непиннутые GitHub Actions | `04-supply-chain.md` |
| A04 | Cryptographic Failures | Свой алгоритм, MD5/SHA1 для паролей, ключи в коде | `02-…`, `03-…` |
| A05 | Injection | SQL через конкатенацию, `$queryRawUnsafe`, command injection в скриптах | `03-…` |
| A06 | Insecure Design | Нет лимитов на бизнес-потоки (регистрация, бонусы) | `06-abuse-and-bot-defense/` |
| A07 | Authentication Failures | Нет MFA/лимитов на логин; слабые сессии | `02-…` |
| A08 | Software or Data Integrity Failures | Автообновление без подписи; загрузка JS с CDN в рантайме | `04-…` |
| A09 | Security Logging and Alerting Failures | Нет аудита, нет алертов на аномалии | `02-by-product-type/05-crm-customer-databases.md` |
| A10 | Mishandling of Exceptional Conditions | Fail-open при ошибке проверки прав; утечка стека в ответе | ниже |

Для сравнения — версия 2021 ([OWASP Top 10:2021](https://owasp.org/Top10/2021/)).

## OWASP API Security Top 10:2023 ([owasp.org](https://owasp.org/API-Security/editions/2023/en/0x11-t10/))
API1 BOLA · API2 Broken Authentication · API3 Broken Object Property Level Authorization · API4 Unrestricted Resource Consumption ([API4](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)) · API5 Broken Function Level Authorization · API6 Unrestricted Access to Sensitive Business Flows ([API6](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)) · API7 SSRF · API8 Security Misconfiguration · API9 Improper Inventory Management · API10 Unsafe Consumption of APIs.

## A10 / «fail-closed» на практике
```ts
// ПЛОХО: ошибка политики → доступ разрешён
try { if (!(await canAccess(user, doc))) return forbid(); } catch { /* ignore */ }
return ok(doc);

// ХОРОШО: любая ошибка → отказ
let allowed = false;
try { allowed = await canAccess(user, doc); } catch (e) { log.error({ e }, "authz_error"); }
if (!allowed) return forbid();
```

## Ресурсы для самопроверки
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) (аутентификация, сессии, пароли, SSRF, SQLi, секреты, логирование).
- [PortSwigger Web Security Academy](https://portswigger.net/web-security/sql-injection) — бесплатные лабы по SQLi, SSRF, IDOR, CSRF, race conditions.
- Шаблон безопасной разработки: [NIST SSDF](https://csrc.nist.gov/projects/ssdf), [CISA Secure by Design](https://www.cisa.gov/securebydesign).

## Что делать / чего не делать

**Делать**
- Проходить по этой таблице при ревью каждого PR, затрагивающего API/auth/данные.
- Fail-closed при любой ошибке в проверке прав.
- Вести инвентарь эндпоинтов (API9): что публично, что требует авторизации, кто владелец.

**Не делать**
- Не считать, что «фреймворк защищает по умолчанию».
- Не возвращать stack trace и внутренние ошибки клиенту.
