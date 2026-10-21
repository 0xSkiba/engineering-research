# Сигналы, связывание аккаунтов, риск-скор и готовые продукты

> Уверенность: **H** — механизмы Stripe/Cloudflare и цены с официальных страниц (проверено 21.10.2026); **L** — все пороги и веса ниже: стартовые значения, калибровать на своём трафике в режиме «только логировать».
> Дополняет [`01-problem-and-layers.md`](01-problem-and-layers.md) и [`03-layered-design.md`](03-layered-design.md): здесь — конкретные эвристики, чем связывать аккаунты в кластер, и что стоят готовые продукты.

## Почему per-account лимит не работает — одной фразой
Per-account лимиты защищают **один аккаунт**. Боты, которые «ведут себя как человек» и переходят на новый аккаунт, атакуют **экономику системы**. Единица лимита должна быть **актор** — кластер аккаунтов, связанных общими сигналами, — а регистрация должна стоить боту дороже, чем выгода от аккаунта.

## Четыре слоя Stripe (эталон)
По блогу Stripe «Scaling your API with rate limiters» ([stripe.com/blog/rate-limiters](https://stripe.com/blog/rate-limiters)):
1. **Request rate limiter** — token bucket на пользователя.
2. **Concurrent requests limiter** — для тяжёлых эндпоинтов («не более N запросов в полёте»).
3. **Fleet usage load shedder** — резерв мощности для критичных запросов; «если резерв — 20%, любой некритичный запрос сверх 80%-ной доли отклоняется с 503».
4. **Worker utilization load shedder** — сброс некритичного трафика при перегрузке воркеров.

Все лимитеры Stripe внедрял сначала в «тёмном» режиме (считать, не блокировать). Делайте так же.

## Чем связывать аккаунты в кластер
Храните на каждый аккаунт при регистрации и при логине:

| Сигнал | Как получить | Что ловит |
|---|---|---|
| IP, подсеть /24 (IPv4), /64 (IPv6), ASN | `CF-Connecting-IP`, MaxMind/ipinfo для ASN | Датацентры (Hetzner, OVH, AWS), один прокси-пул |
| Visitor ID устройства | FingerprintJS OSS (бесплатно, слабее) или Fingerprint Pro | Один браузер → много аккаунтов |
| JA4 (TLS ClientHello) | На своём TLS-прокси или в Cloudflare Enterprise Bot Management | UA «Chrome» + JA4 Python/Go-клиента = скрипт. Cloudflare «JA4 Signals»: новый JA4, внезапно появившийся на многих сайтах, выдаёт ботнет независимо от числа IP ([blog](https://blog.cloudflare.com/ja4-signals/)) |
| Канонический email | `a.b+tag@gmail.com` → `ab@gmail.com`; блок одноразовых доменов | Паттерны `name1234@`, одинаковые домены |
| Кошелёк / адрес вывода / граф фондирования | On-chain | Для крипто: один кошелёк кормит 50 аккаунтов |
| UA + экран + таймзона + язык | Клиент | Однотипность профилей |
| HMAC(пароль) | Сервер | Одинаковые пароли у «разных» людей |

Схема хранения:
```sql
CREATE TABLE account_signals (
  account_id  uuid NOT NULL,
  signal_type text NOT NULL,      -- 'ip24' | 'asn' | 'device' | 'ja4' | 'email_norm' | 'wallet' | 'pw_hmac'
  signal_hash text NOT NULL,      -- HMAC(secret, value), не сырое значение
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, signal_type, signal_hash)
);
CREATE INDEX ON account_signals (signal_type, signal_hash);  -- "кто ещё с этим сигналом"
```
Кластер = связные компоненты графа «аккаунт — сигнал — аккаунт». Ежечасная джоба считает кластеры и пишет `cluster_id` в аккаунт; лимиты и санкции применяются **к кластеру**.

## Эвристики детекции (стартовые пороги, L)
- **Тайминги:** интервалы между запросами с очень низкой дисперсией (σ < ~5% от среднего) — скрипт. Люди не делают запрос ровно каждые 2.000 с.
- **Последовательность:** удары прямо в `/api/*` без загрузки страницы и без запросов к `/_next/static/*`.
- **Скорость кластера:** > N регистраций за час с одного /24, /64, ASN хостинга или одного visitorId (старт: 5–10 в час).
- **Однотипность:** одинаковые UA+JA4+экран, email по шаблону, совпадающие HMAC паролей.
- **Невозможные перемещения:** один аккаунт — две страны за 10 минут.
- **Общие кошельки / адреса вывода** → объединять в кластер без вопросов.
- **Ханипоты:** скрытое поле формы (`display:none`), которое заполняют только боты; эндпоинт-ловушка, на который нет ссылок в UI.
- **Нагрузка:** стоимость запросов на кластер за сутки против медианы.

## Риск-скор и прогрессивные санкции
Скор 0–100 — сумма весов сигналов. Действие по порогу:

| Скор | Действие | Зачем |
|---|---|---|
| 0–30 | Пропуск | Обычный пользователь |
| 30–60 | Turnstile / PoW + сниженные лимиты | Дорого боту, почти незаметно человеку |
| 60–80 | **Shadow ban** (действие «успешно», но без эффекта) + **tarpit** (задержка ответа 2–10 с) | Бот не понимает, что пойман, и не адаптируется |
| > 80 | Блок всего кластера | Явный злоумышленник |

Тихие санкции важнее жёстких блоков: явный 403 — это сигнал боту менять тактику. См. [`03-layered-design.md`](03-layered-design.md), функция `decide()`.

## Защита регистрации (ключ к сценарию «ротация аккаунтов»)
- **Turnstile** на регистрации, логине, восстановлении пароля; токен проверять на сервере (`siteverify`), он одноразовый, живёт 300 с. Бесплатный план: без лимита проверок, до 20 виджетов ([plans](https://developers.cloudflare.com/turnstile/plans/)).
- **Email обязателен** до любого ценного действия; блок одноразовых доменов ([disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)); нормализация.
- **Телефон** — только эскалация для подозрительных кластеров: дорого для конверсии и есть риск SMS-pumping.
- **Proof-of-work** (ALTCHA-подход, `examples/rate-limit/pow.ts`) — удорожает массовую регистрацию без раздражения людей.
- **Отложенная ценность:** новый аккаунт не получает бонусов/дорогих эндпоинтов первые N часов; квота растёт с возрастом и верификацией.
- **Крипто:** SIWE/SIWS-подпись при регистрации, минимальный on-chain возраст/баланс кошелька для airdrop-механик, граф фондирования.

## Реализация на Redis и Nginx
Sliding window в Redis (атомарно через `EVAL`):
```lua
-- KEYS[1]=key; ARGV[1]=now_ms, ARGV[2]=window_ms, ARGV[3]=limit, ARGV[4]=member
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
```
Token bucket с весом запроса — `examples/rate-limit/token-bucket.lua`. Ключи, которые проверяются **все одновременно** (AND):
```ts
const keys = [
  `rl:ip:${ip}`, `rl:sub24:${subnet}`, `rl:asn:${asn}`, `rl:acct:${userId}`,
  `rl:device:${visitorId}`, `rl:ja4:${ja4}`, `rl:cluster:${clusterId}`, `rl:global:${endpoint}`,
];
```
Nginx перед приложением (за Cloudflare — обязательно `real_ip_header CF-Connecting-IP` и `set_real_ip_from` для диапазонов Cloudflare, иначе все лимиты посчитаются по IP Cloudflare):
```nginx
limit_req_zone $binary_remote_addr zone=perip:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=signup:10m rate=3r/m;
location /api/        { limit_req zone=perip  burst=20 nodelay; }
location /api/signup  { limit_req zone=signup burst=2; }
proxy_set_header x-middleware-subrequest "";   # CVE-2025-29927, см. 02-by-product-type/01-web-apps.md
```
`fail2ban` по 401/429 помогает против грубого перебора; против «вежливых» ботов, живущих под лимитом, — нет.

## Готовые продукты и цены (официальные страницы, 21.10.2026)
| Продукт | Бесплатно | Платно | Кому |
|---|---|---|---|
| [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/plans/) | Без лимита проверок, 20 виджетов, 10 хостнеймов/виджет | Enterprise по запросу | Всем, сразу |
| [Fingerprint](https://fingerprint.com/pricing/) | 1 000 API-вызовов/мес | Pro Plus $99/мес за 20 тыс., далее $4 за 1 000 | Когда OSS FingerprintJS уже не ловит |
| [Castle](https://castle.io/pricing/) | $5 usage (~1 000 Risk API) | Pro $200/мес; Enterprise от $4 000/мес | Готовый риск-скор на регистрацию/логин |
| [DataDome](https://datadome.co/pricing/) | Триал 30 дней | Essentials $3 830/мес … Enterprise от $13 270/мес | Крупный бизнес |
| Arkose Labs ([AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-jgqogfxt34fku)) | — | $250 000 за 12 мес + $1 000 за млн сессий | Крупный бизнес |
| Cloudflare Bot Management (JA4 поля, bot score) | Базовый bot fight mode на Free | Enterprise | При росте |

Вывод: DataDome и Arkose — не для соло-билдера. Реалистичный стек на Hetzner: **Cloudflare (Free/Pro) + Turnstile + FingerprintJS OSS → Fingerprint Pro Plus или Castle Pro + свой скоринг на Redis/Postgres**.

## Многоуровневый чеклист (порядок внедрения)
1. Cloudflare перед Hetzner; origin принимает только IP Cloudflare (или Cloudflare Tunnel) — иначе боты бьют в origin напрямую.
2. Nginx `limit_req` по IP + строгие зоны для `/signup`, `/login`, дорогих эндпоинтов.
3. Turnstile на регистрации/логине/восстановлении; серверная проверка.
4. Подтверждение email, блок одноразовых доменов, нормализация.
5. На каждый аккаунт сохраняются visitorId, IP/24, ASN, JA4, кошелёк (`account_signals`).
6. Redis-лимиты по каждому ключу **и по кластеру**, cost-based на дорогих эндпоинтах, глобальный предохранитель.
7. Риск-скор → challenge → shadow ban / tarpit → блок кластера.
8. Ханипоты; дашборд регистраций по ASN/подсети/устройству с алертом на всплески (> 3× от среднего за этот час недели); еженедельный разбор кластеров, которые прошли.

## Что делать / чего не делать

**Делать**
- Лимитировать кластер, а не аккаунт; банить кластер, а не аккаунт.
- Включать новые правила в режиме «только логировать» на неделю, смотреть ложные срабатывания (CGNAT, офисные NAT, VPN).
- Хранить сигналы как HMAC, с TTL (GDPR), и упомянуть антифрод в privacy policy.

**Не делать**
- Не возвращать боту точную причину отказа и пороги.
- Не ставить обязательный телефон для всех — потеряете людей, а SMS-фермы останутся.
- Не покупать DataDome/Arkose раньше, чем выжаты Turnstile + сигналы + кластеризация.

## Источники
- Stripe — Scaling your API with rate limiters: https://stripe.com/blog/rate-limiters
- Cloudflare — JA4 Signals: https://blog.cloudflare.com/ja4-signals/
- Cloudflare — Per-customer bot defenses: https://blog.cloudflare.com/per-customer-bot-defenses/
- Cloudflare — Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Fingerprint pricing: https://fingerprint.com/pricing/
- Castle pricing: https://castle.io/pricing/
- DataDome pricing: https://datadome.co/pricing/
- Arkose Labs на AWS Marketplace: https://aws.amazon.com/marketplace/pp/prodview-jgqogfxt34fku
- JA3/JA4 guide: https://scrapfly.io/blog/posts/ja3-ja4-tls-fingerprinting-guide-to-detection-and-evasion
