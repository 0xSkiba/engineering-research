# Как это делают Cloudflare, Stripe, Discord, GitHub, Twitter/X, Meta

> Уверенность указана по каждому пункту. Страницы support.discord.com, help.x.com, blog.x.com и cloudflare.com/learning за Cloudflare-челленджем (403) — мы их не обходили, использованы другие источники.

## Stripe — лимитеры и Radar
- Четыре механизма: request rate limiter, concurrent requests limiter («only have 20 API requests in progress»), fleet usage load shedder, worker utilization load shedder; реализация — token bucket в Redis ([Stripe: Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)). **H**
- Load shedder резервирует часть ресурсов для критичных запросов и отбрасывает некритичные при перегрузке (там же). **H**
- Radar оценивает более 1,000 характеристик транзакции ([Stripe: how we built Radar](https://stripe.com/blog/how-we-built-it-stripe-radar); [Radar docs](https://docs.stripe.com/radar); [правила Radar](https://docs.stripe.com/radar/rules)). **H**
- Card testing: одна эвристика (IP) обычно недостаточна; встроены rate limiters, AI-модели, CAPTCHA ([Stripe: card testing](https://docs.stripe.com/disputes/prevention/card-testing)). **H**
- Урок: лимиты разных типов (скорость, параллельность, глобальная перегрузка) + ML-скор + правила.

## Cloudflare — скор, fingerprint, Turnstile, rate limiting
- Bot Management: пять комплементарных механизмов детекции объединяются в один скор; большинство решений — ML ([Cloudflare blog](https://blog.cloudflare.com/cloudflare-bot-management-machine-learning-and-more/); [bot score](https://developers.cloudflare.com/bots/concepts/bot-score/)). **H**
- Резидентные прокси: ротация IP обходит IP-репутацию и IP-лимиты → нужны ML и сетевые/TLS-сигналы ([residential proxy ML](https://blog.cloudflare.com/residential-proxy-bot-detection-using-machine-learning/)). **H**
- TLS-отпечатки JA3/JA4 и JA4 signals ([docs](https://developers.cloudflare.com/bots/concepts/ja3-ja4-fingerprint/); [JA4 signals](https://blog.cloudflare.com/ja4-signals/); [FoxIO JA4](https://github.com/FoxIO-LLC/ja4)). **H**
- Rate limiting rules: счётчики по характеристикам (IP, IP с поддержкой NAT, заголовки, cookie, поля Bot Management и др.) ([rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/); [параметры](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/); [best practices](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/); [advanced rate limiting](https://blog.cloudflare.com/advanced-rate-limiting/)). **H**
- Turnstile: фоновые in-browser проверки вместо картинок ([Turnstile GA](https://blog.cloudflare.com/turnstile-ga/); [конец CAPTCHA](https://blog.cloudflare.com/end-cloudflare-captcha/)); **серверная проверка Siteverify обязательна**, токен живёт 300 с и одноразовый ([server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)). **H**
- Защита от захвата аккаунтов и персональные модели под сайт ([ATO](https://blog.cloudflare.com/account-takeover-protection/); [per-customer defenses](https://blog.cloudflare.com/per-customer-bot-defenses/)). Privacy Pass как альтернатива повторным челленджам ([RFC 9576](https://www.rfc-editor.org/rfc/rfc9576.html)). **H**

## Discord — лимиты, правила, челленджи
- Лимиты per-route и глобальные; IP, делающие слишком много невалидных запросов, временно ограничиваются (10,000 за 10 минут) ([Discord rate limits](https://discord.com/developers/docs/topics/rate-limits)). **H**
- Safety Rules Engine оценивает регистрации, вступления в серверы и метаданные → челленджи или баны ([Discord safety](https://discord.com/safety/360043700632-discords-commitment-to-a-safe-and-trusted-experience)). **H**
- Кнопка «Report Spam» в DM увеличила выявление нарушителей на 1000%; тестировали «safe mode» сервера с капчей для новых участников ([Discord: fighting spam](https://discord.com/safety/how-discord-is-fighting-spam)). **H**
- Инженер Discord на HN: контент с выходных нод Tor проверяется строже → капча или подтверждение телефона ([HN](https://news.ycombinator.com/item?id=20791163)). **M** (комментарий, не официальная документация)
- Уровни верификации серверов (email, возраст аккаунта, телефон) — описаны в справке Discord, которая отдала нам 403; **не проверено нами напрямую** (**L**).

## GitHub — квоты и антиспам
- REST: 60 запросов/ч без аутентификации, 5,000/ч для пользователя, 15,000/ч для Enterprise Cloud; вторичные лимиты: не более 100 параллельных запросов и лимиты по «очкам» в минуту ([REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits); [GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)). **H**
- Открытый инструмент модерации спама с помощью AI: [github/ai-moderator](https://github.com/github/ai-moderator). **H** (что он существует)
- Сторонний разбор спама на GitHub: флаг новых пользователей с пустыми профилями, simhash для почти-дубликатов комментариев ([Trench](https://www.trytrench.com/blog/preventing-spam-and-fake-stars-github)). **M**

## Shopify / GitHub GraphQL — лимиты по стоимости запроса
- Лимит считается по вычисленной сложности запроса, а не по количеству ([Shopify: query complexity](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity); [Shopify limits](https://shopify.dev/docs/api/usage/limits)). **H** — прямой образец для «стоимостных» лимитов на дорогие эндпоинты.

## Twitter/X и Meta
- Twitter 2018: новые аккаунты должны подтверждать email или телефон ([Mashable](https://mashable.com/article/twitter-tackles-bots-abuse-automation); оригинальный пост blog.x.com — 403 для нас). **M**
- Отчёты X о манипуляции платформой ([X transparency](https://transparency.x.com/en/reports/platform-manipulation)). **M**
- Meta: системы ищут фейковые аккаунты сразу при регистрации по сигналам вроде подозрительных email и действий ([Meta](https://about.fb.com/news/2019/05/fake-accounts/)). **H**

## Публичные лимиты популярных API (для ориентира)
[OpenAI](https://platform.openai.com/docs/guides/rate-limits), [Anthropic](https://docs.anthropic.com/en/api/rate-limits), [Notion](https://developers.notion.com/reference/request-limits), [Figma](https://developers.figma.com/docs/rest-api/rate-limits/), [X API](https://docs.x.com/x-api/fundamentals/rate-limits) — квоты по ключу + тарифам/уровням, растущие с историей оплат (у OpenAI — usage tiers). **H** для наличия; детали меняются.

## Инструменты (самостоятельно)
- Одноразовые email: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains).
- Fingerprint: [FingerprintJS (OSS)](https://github.com/fingerprintjs/fingerprintjs) — точность OSS-версии ниже коммерческой (**M**).
- PoW/невидимые капчи: [ALTCHA](https://altcha.org/), [Friendly Captcha](https://docs.friendlycaptcha.com/), [hCaptcha](https://www.hcaptcha.com/), [reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3) / [account defender](https://cloud.google.com/recaptcha/docs/account-defender), [Turnstile](https://developers.cloudflare.com/turnstile/).
- IP-репутация: [MaxMind Anonymous IP](https://www.maxmind.com/en/geoip-anonymous-ip-database), [minFraud](https://www.maxmind.com/en/solutions/minfraud-services), [Spamhaus DROP](https://www.spamhaus.org/drop/).
- Rate limiting: [brandur: GCRA](https://brandur.org/rate-limiting), [Redis](https://redis.io/glossary/rate-limiting/), [AWS WAF rate-based](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html).
- Ответы: 429 + `Retry-After` ([RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html); [MDN 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429); [draft RateLimit headers](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)).

## Что делать / чего не делать

**Делать**
- Копировать подход Stripe: несколько лимитеров разного типа + load shedding с приоритетами.
- Использовать Turnstile/PoW с обязательной серверной проверкой токена.
- Лимитировать дорогие эндпоинты по стоимости, как Shopify/GitHub GraphQL.
- Давать новым аккаунтам меньшие квоты, повышать с репутацией/оплатой (как usage tiers).

**Не делать**
- Не принимать токен капчи без Siteverify и без проверки одноразовости.
- Не блокировать по одному IP-сигналу — Stripe и Cloudflare прямо пишут, что этого недостаточно.
- Не строить свою ML-систему раньше простых правил, лимитов и логов.
