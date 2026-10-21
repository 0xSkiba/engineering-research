# Мобильные и десктопные приложения

> Уверенность: **H** (OWASP MASVS, Google Play, Apple, Electron docs).

## Мобильные (iOS/Android, React Native/Expo)
- **Клиент — недоверенная среда.** Всё, что в бинарнике, можно извлечь: никаких секретов API/приватных ключей в приложении ([OWASP Mobile Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html); стандарт [MASVS](https://mas.owasp.org/MASVS/)).
- **Безопасное хранение**: Keychain/Keystore для токенов; не AsyncStorage/SharedPreferences в открытом виде (MASVS-STORAGE).
- **Постепенная выкатка**: staged rollout в Google Play — обновление только для процента пользователей ([Play Console](https://support.google.com/googleplay/android-developer/answer/6346149)). Откат мобильного релиза невозможен — пользователи уже скачали билд, поэтому нужны **серверные флаги и принудительное обновление (min supported version)**.
- **Качество**: Android vitals (краши, ANR) ([Android vitals](https://developer.android.com/topic/performance/vitals)); время запуска на iOS ([Apple](https://developer.apple.com/documentation/xcode/reducing-your-app-s-launch-time)).
- **Ревью магазинов**: правила App Store о крипто-функциях и др. ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)) — проверять до разработки фичи.
- **API для мобильных клиентов** должен быть обратно совместим: старые версии приложения живут месяцами (см. версионирование Stripe: [APIs as infrastructure](https://stripe.com/blog/api-versioning)).

## Десктоп (Electron/Tauri)
- Electron: `contextIsolation`, `sandbox`, отключённый `nodeIntegration` для удалённого контента, CSP, осторожно с `shell.openExternal` ([Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)).
- Автообновления — подписанные, по HTTPS; канал обновления — это канал поставки кода (supply chain).

## Что делать / чего не делать

**Делать**
- Держать секреты только на сервере; мобильный клиент получает короткоживущие токены.
- Внедрить серверный kill switch и «минимальную поддерживаемую версию».
- Выкатывать мобильные релизы через staged rollout и мониторить краши.
- В Electron включить sandbox и contextIsolation.

**Не делать**
- Не хранить приватные ключи/seed в незашифрованном хранилище.
- Не ломать API для старых версий приложения.
- Не загружать удалённый контент в окно с Node-доступом.
