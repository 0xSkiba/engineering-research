# Источники синтез-ресерча (21.10.2026)

Источники, использованные в файлах, добавленных из третьего ресерча: `01-how-big-companies-work/07-ai-agent-workflow.md`, `02-by-product-type/07-crm-data-model-sql.md`, `03-anti-patterns-and-beginner-mistakes/05-backend-frontend-typescript-mistakes.md`, `04-database-scaling-and-sharding/07-when-not-to-shard-numbers.md`, `05-security-mistakes/07-crypto-bot-operations.md`, `05-security-mistakes/08-concrete-defenses-ts-node.md`, `06-abuse-and-bot-defense/04-signals-risk-score-products.md`, `07-checklists/SHIP-CHECKLIST-solo.md`.

Оговорки: цифры компаний — самоотчёты из инженерных блогов, независимо не проверены; суммы взломов расходятся между источниками (Ronin $624–625 млн; Knight $440 млн по 8-K и «более $460 млн» по SEC); цены bot-management меняются — перепроверить перед покупкой; пороги эвристик — стартовые значения.

## Масштабирование БД
- OpenAI — Scaling PostgreSQL to power 800 million ChatGPT users: https://openai.com/index/scaling-postgresql/
- Notion — Sharding Postgres at Notion: https://www.notion.com/blog/sharding-postgres-at-notion
- Figma — How Figma's databases team lived to tell the scale: https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/
- Discord → ScyllaDB (InfoQ): https://www.infoq.com/news/2023/06/discord-cassandra-scylladb/
- Slack — Scaling datastores at Slack with Vitess: https://slack.engineering/scaling-datastores-at-slack-with-vitess/
- Stripe DocDB (InfoQ presentation): https://www.infoq.com/presentations/docdb-online-database/
- Instagram sharding (пересказ): https://haiderzdbre.substack.com/p/how-instagram-sharded-postgresql-with-2-engineers

## Инциденты
- GitLab — Postmortem of database outage of January 31: https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/
- Cloudflare — 18 November 2025 outage: https://blog.cloudflare.com/18-november-2025-outage/
- SEC — Knight Capital (Release 34-70694): https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf
- Knight Capital разбор: https://dev.to/axrisi/knight-capital-how-a-reused-feature-flag-lost-460-million-133j
- Next.js CVE-2025-29927: https://dev.to/emil_alander_7c/nextjs-middleware-auth-bypass-cve-2025-29927-36no · https://www.guardlayer.io/blog/nextjs-middleware-auth-bypass-cve-2025-29927

## Безопасность
- OWASP Top 10:2025 Introduction: https://owasp.org/Top10/2025/0x00_2025-Introduction/
- Разбор OWASP 2025: https://nurbak.com/en/blog/owasp-top-10-2025/
- CISA — Widespread Supply Chain Compromise Impacting npm Ecosystem (23.09.2025): https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem

## Rate limiting и боты
- Stripe — Scaling your API with rate limiters: https://stripe.com/blog/rate-limiters
- Cloudflare — Per-customer bot defenses: https://blog.cloudflare.com/per-customer-bot-defenses/
- Cloudflare — JA4 Signals: https://blog.cloudflare.com/ja4-signals/
- JA4 fingerprinting guides: https://webdecoy.com/blog/ja4-fingerprinting-ai-scrapers-practical-guide/ · https://blog.crawlex.net/blog/cloudflare-tls-http2-fingerprinting/ · https://scrapfly.io/blog/posts/ja3-ja4-tls-fingerprinting-guide-to-detection-and-evasion
- Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Fingerprint pricing: https://fingerprint.com/pricing/
- FingerprintJS alternatives: https://blog.send.win/fingerprintjs-alternatives-compared-open-source-vs-paid/
- Castle pricing: https://castle.io/pricing/
- DataDome pricing: https://datadome.co/pricing/
- Arkose Labs (AWS Marketplace): https://aws.amazon.com/marketplace/pp/prodview-jgqogfxt34fku · https://www.rfp.wiki/payments-fraud/fraud-detection/arkose-labs

## Крипто
- Sygnia — Bybit: https://www.sygnia.co/blog/sygnia-investigation-bybit-hack/
- BleepingComputer — Bybit via Safe{Wallet} dev machine: https://www.bleepingcomputer.com/news/security/lazarus-hacked-bybit-via-breached-safe-wallet-developer-machine/
- BleepingComputer — FBI confirms Lazarus: https://www.bleepingcomputer.com/news/security/fbi-confirms-lazarus-hackers-were-behind-15b-bybit-crypto-heist/
- Bybit разборы: https://odinscan.ai/blog/bybit-1-5-billion-hack-explained · https://onrampbitcoin.com/knowledge-center/how-was-bybit-hacked
- Merkle Science — Ronin: https://www.merklescience.com/blog/hack-track-analysis-of-ronin-network-exploit
- Nomad: https://smartcontractauditor.ai/blog/nomad-bridge-hack-analysis-190m-in-2022
- Euler: https://olympix.security/blog/eulers-197m-self-liquidation-loophole-and-how-olympix-would-have-flagged-it-before-deployment · https://cryptohawking.com/blog/euler-finance-donation-attack-postmortem · https://medium.com/spoolfi/the-euler-finance-197-million-hack-90fa98064ffa
- Bridge hacks overview: https://www.spark.money/research/stablecoin-bridge-hack-postmortem-lessons · https://www.cryptoimpacthub.com/why-cross-chain-bridges-keep-getting-hacked-anatomy-of-web3s-most-dangerous-attack-surface/
