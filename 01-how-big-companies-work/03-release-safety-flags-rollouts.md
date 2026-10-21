# Безопасные релизы: feature flags, канарейки, постепенная выкатка, откат

> Уверенность: **H** (AWS Builders' Library, Meta, GitHub, Uber, Google SRE).

## Принцип: отделить *деплой кода* от *включения функции* и выкатывать постепенно

### Meta — квази-непрерывный релиз
- Переход на «push from master»: сначала сотрудники, затем 2% продакшена, затем 100%, с «emergency stop button» ([Rapid release at massive scale](https://engineering.fb.com/2017/08/31/web/rapid-release-at-massive-scale/)).
- Многие изменения скрыты за системой **Gatekeeper** — при проблеме фичу выключают, не откатывая релиз (там же).

### GitHub — флаги и staff-shipping
- Рискованные изменения — за флагом; включают на процент «акторов», при проблеме выключают «in a matter of seconds» ([How we ship code faster and safer with feature flags](https://github.blog/2021-04-27-ship-code-faster-safer-feature-flags/)).
- Перед релизом фичу включают всем сотрудникам GitHub (staff shipping) (там же).
- **Scientist** — библиотека для «shadow»-сравнения старого и нового пути кода на продакшен-трафике ([Scientist](https://github.blog/engineering/engineering-principles/scientist/); [github/scientist](https://github.com/github/scientist)).

### Uber — Flipr
- Динамическая конфигурация с правилами (город, пользователь, версия приложения) для флагов и инкрементальной выкатки; заявлено >350K активных свойств и ~150K изменений в неделю ([Flipr](https://www.uber.com/blog/flipr/), прочитано через WebFetch). Изменения конфигурации требуют peer review и могут авто-откатываться по метрикам (там же).

### AWS — автоматические «hands-off» деплои
- Конвейер: pre-prod (alpha/beta/gamma) → **one-box** (одна машина/контейнер) → волны по регионам с bake time и авто-откатом по алармам ([Automating safe, hands-off deployments](https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments/)).
- **Конфигурация (лимиты, флаги) деплоится тем же конвейером** с теми же откатами (там же). Это прямой урок из инцидентов Cloudflare (ниже).
- **Безопасность отката**: новая версия должна уметь работать рядом со старой; формат данных меняют в 2 фазы — сначала «читать новое», потом «писать новое» ([Ensuring rollback safety](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)) (фаза Prepare — научить читать оба формата; фаза Activate — начать писать новый).
- [Going faster with continuous delivery](https://aws.amazon.com/builders-library/going-faster-with-continuous-delivery/).

### Google SRE — канарейки
- Canarying: сравнивать небольшую долю трафика на новой версии с контрольной группой ([SRE workbook: Canarying Releases](https://sre.google/workbook/canarying-releases/)); release engineering — герметичные, воспроизводимые сборки ([SRE book: Release Engineering](https://sre.google/sre-book/release-engineering/)).

### Мобильные приложения
- Google Play поддерживает **staged rollouts** — обновление получает только процент пользователей ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/6346149)). На мобильных откат кода невозможен — поэтому серверные флаги критичны.

## Анти-уроки: глобальная выкатка конфигурации
- **Cloudflare, 2 июля 2019**: новое WAF-правило с регулярным выражением, которое «backtracked enormously», выкатили глобально и исчерпали CPU по всей сети ([postmortem](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)).
- **Cloudflare, 18 ноября 2025**: изменение прав в БД (ClickHouse) удвоило «feature file» Bot Management; файл превысил лимит размера в прокси и распространился на всю сеть ([postmortem](https://blog.cloudflare.com/18-november-2025-outage/)).
- **Knight Capital, 2012**: новый код не был скопирован на 1 из 8 серверов; повторно использованный флаг активировал мёртвый код «Power Peg»; убыток >$460M за ~45 минут ([SEC order](https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf), [пресс-релиз SEC](https://www.sec.gov/newsroom/press-releases/2013-222)). SEC отдельно отмечает: не было второй проверки деплоя, не было процедуры реагирования, и не было kill switch.

## Минимальная схема для соло-продукта
1. Флаги в БД/конфиге с полями `enabled`, `percent`, `allowlist`, `updated_by`, `updated_at` (аудит изменений).
2. Новый код всегда выключен по умолчанию; включение: вы → 1–5% → 25% → 100%.
3. Каждый флаг имеет владельца и дату удаления (флаги-«зомби» — это мёртвый код как у Knight).
4. Kill switch для опасных функций (вывод средств, массовые рассылки, внешние вызовы).
5. Конфиг валидируется схемой (zod) до применения; невалидный конфиг — отклоняется, а не «доходит до прода».

## Что делать / чего не делать

**Делать**
- Разделять deploy и release: код за флагом, включение постепенно.
- Иметь кнопку быстрого отключения для каждой рискованной функции.
- Деплоить конфигурацию так же осторожно, как код: валидация, постепенность, откат.
- Удалять старые флаги и мёртвый код после полной выкатки.

**Не делать**
- Не переиспользовать старые флаги/поля под новую семантику (урок Knight Capital).
- Не выкатывать «глобально и сразу» правила WAF, лимиты, списки блокировок.
- Не полагаться на «откатимся, если что» без проверки, что старая версия умеет читать новые данные.
