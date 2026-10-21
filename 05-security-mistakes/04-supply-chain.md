# Атаки на цепочку поставок (npm, GitHub Actions, CDN)

> Уверенность: **H**. Особенно важно для JS/TS-стека и крипто-проектов: вредоносный пакет может подменить адрес получателя или украсть ключи.

## Реальные случаи
| Год | Случай | Механизм | Источник |
|---|---|---|---|
| 2018 | event-stream / flatmap-stream | Новый «мейнтейнер» добавил зависимость с кодом, нацеленным на кошелёк Copay (кражa ключей с балансом >100 BTC / >1000 BCH); вредонос попал в версии Copay 5.0.2–5.1.0 | [npm blog](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident); [issue #116](https://github.com/dominictarr/event-stream/issues/116) |
| 2021 | Codecov bash uploader | Изменённый скрипт отправлял `env` (секреты CI) атакующему | [Codecov](https://about.codecov.io/security-update/) |
| 2022 | OAuth-токены Heroku/Travis CI | Украденные токены интеграций → выгрузка приватных репозиториев, включая npm | [GitHub](https://github.blog/2022-04-15-security-alert-stolen-oauth-user-tokens/) |
| 2023 | Ledger Connect Kit | Фишинг npm-аккаунта бывшего сотрудника; вредоносные 1.1.5–1.1.7; dApp’ы грузили код с CDN в рантайме; ~5 ч до полного устранения | [Ledger](https://www.ledger.com/blog/security-incident-report) |
| 2024 | xz-utils (CVE-2024-3094) | Бэкдор в 5.6.0/5.6.1 после многолетней социальной инженерии | [CISA](https://www.cisa.gov/news-events/alerts/2024/03/29/reported-supply-chain-compromise-affecting-xz-utils-data-compression-library-cve-2024-3094) |
| 2024 | Ultralytics (PyPI) | Инъекция в GitHub Actions/кэш + неотозванный API-токен | [PyPI](https://blog.pypi.org/posts/2024-12-11-ultralytics-attack-analysis/) |
| 2025 | tj-actions/changed-files | Скомпрометированный Action печатал секреты в логи | [CISA](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-tj-actionschanged-files-cve-2025-30066-and-reviewdogaction) |
| 2025 | Nx «s1ngularity» | Инъекция в GitHub Actions → кража npm-токена → вредоносные версии 4 часа; postinstall искал секреты, в т.ч. через локальные AI CLI | [Nx](https://nx.dev/blog/s1ngularity-postmortem) |
| 2025 | chalk/debug и др. | Фишинг мейнтейнера («обновите 2FA»); пакеты с >2.6 млрд загрузок в неделю | [BleepingComputer](https://www.bleepingcomputer.com/news/security/hackers-hijack-npm-packages-with-2-billion-weekly-downloads-in-supply-chain-attack/); [Aikido](https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised) |
| 2025 | Shai-Hulud | Самораспространяющийся червь в npm: postinstall, кража токенов, публикация через GitHub Actions | [Sysdig](https://www.sysdig.com/blog/shai-hulud-the-novel-self-replicating-worm-infecting-hundreds-of-npm-packages); [CISA](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem) |
| 2025 | Slopsquatting | Модели выдумывают несуществующие пакеты (≥5.2% у коммерческих моделей) | [USENIX Sec 2025](https://www.usenix.org/system/files/usenixsecurity25-spracklen.pdf) |

## Меры
**Зависимости**
- Lockfile в git; `npm ci` в CI ([npm ci](https://docs.npmjs.com/cli/v10/commands/npm-ci)); по возможности `--ignore-scripts` и явный allowlist пакетов, которым нужны install-скрипты.
- Новые зависимости — только осознанно: существует ли, возраст, мейнтейнеры, загрузки, нет ли typosquat.
- Dependabot/Renovate для security-обновлений ([Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates)), но с задержкой для не-security обновлений (свежая версия может быть вредоносной) — **M**.
- Публикуете свои пакеты — npm provenance / trusted publishing ([npm provenance](https://docs.npmjs.com/generating-provenance-statements)).

**GitHub Actions** ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use); [pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/))
- Пиннинг сторонних actions по полному SHA.
- `permissions:` минимальные по умолчанию (`contents: read`).
- Осторожно с `pull_request_target` и `workflow_run` + checkout кода PR.
- Секреты — только в нужных job’ах/environments с approval.

**Рантайм/фронтенд**
- Не грузить критичный JS с внешних CDN «последней версии»; SRI для внешних скриптов; CSP.
- Уровни зрелости цепочки поставок: [SLSA](https://slsa.dev/spec/v1.1/levels); практики: [NIST SSDF](https://csrc.nist.gov/projects/ssdf).

**Аккаунты**
- Фишинго-устойчивая 2FA (passkeys/ключи) на npm, GitHub, регистраторе доменов, облаке, Cloudflare.
- Регулярный аудит токенов и OAuth-приложений; отзыв при уходе людей/подрядчиков.

## Что делать / чего не делать

**Делать**
- Пиннить actions по SHA, ограничивать `permissions`, проверять каждую новую зависимость.
- Держать dev-машину и CI без прод-секретов, где возможно.
- Мониторить advisories и быстро обновлять при критичных CVE.

**Не делать**
- Не ставить пакеты, предложенные агентом, без проверки существования и репутации.
- Не запускать `npm install` в окружении с прод-ключами и кошельками.
- Не использовать долгоживущие npm/PyPI-токены в CI вместо trusted publishing.
