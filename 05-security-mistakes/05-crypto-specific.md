# Крипто-специфичные ошибки безопасности

> Уверенность: **H** для классов уязвимостей (официальная документация), **M** для рекомендаций по процессу. Не является аудитом: перед деплоем контрактов с деньгами пользователей нужен внешний аудит.

## Карта рисков: OWASP Smart Contract Top 10 (2026)
SC01 Access Control … SC10 Proxy & Upgradeability ([OWASP SC Top 10](https://scs.owasp.org/sctop10/)). Дополнительно: [SWC Registry](https://swcregistry.io/) (исторический), [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html).

## 1. Приватные ключи и операционная безопасность
- Крупнейшие потери последних лет — не баги контрактов, а компрометация ключей/подписантов: по Chainalysis, КНДР украла $2.02 млрд в 2025 году ([Chainalysis 2025](https://www.chainalysis.com/blog/crypto-hacking-stolen-funds-2026/)); Bybit (2025) и WazirX (2024) — подписанты мультисигов подписали вредоносную транзакцию (см. `06-crypto-hack-postmortems.md`).
- Правила: ключи деплоя/админа — на аппаратных кошельках, никогда в `.env` на ноутбуке и не в CI; мультисиг (напр., Safe) с независимыми устройствами подписантов ([Safe docs](https://docs.safe.global/home/what-is-safe)); timelock для админ-операций.
- **Слепая подпись** — главный вектор: проверять calldata/операцию (`call` vs `delegatecall`) на независимом устройстве. Bybit: интерфейс Safe был подменён ([Sygnia](https://www.sygnia.co/blog/sygnia-investigation-bybit-hack/)).

## 2. Контроль доступа (SC01)
- Каждая привилегированная функция: `onlyOwner`/роль ([OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control)); отдельные роли (pauser, upgrader, minter); `Ownable2Step`.
- Тест: «не-админ получает revert» для каждой привилегированной функции.

## 3. Reentrancy
- Checks-Effects-Interactions + `ReentrancyGuard` ([Solidity docs](https://docs.soliditylang.org/en/latest/security-considerations.html#reentrancy); [OZ ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard)).
- Read-only reentrancy и баги компилятора: Curve 2023 — защита `nonreentrant` в Vyper 0.2.15/0.2.16/0.3.0 не работала ([Vyper postmortem](https://hackmd.io/@vyperlang/HJUgNMhs2)).

## 4. Оракулы и манипуляция ценой
- Не использовать спот-цену AMM как оракул; TWAP на неликвидном пуле тоже манипулируем (Inverse Finance 2022 — [rekt](https://rekt.news/inverse-finance-rekt/)).
- Chainlink: проверять `updatedAt`/staleness, раунд, границы; **для RWA важно**: фиды акций США обновляются только в торговые часы ([Chainlink market hours](https://docs.chain.link/data-feeds/selecting-data-feeds#market-hours)). Для Remainder (RWA perps) — показывать «рынок закрыт/данные устарели», а не последнюю цену как актуальную (**M**).
- Mango Markets 2022: манипуляция ценой MNGO на неликвидном рынке → «заём» под раздутый залог ([CFTC](https://www.cftc.gov/PressRoom/PressReleases/8647-23)).

## 5. Upgradeable proxy
- Неинициализированные implementation, коллизии хранилища, `initializer` вызывается дважды ([OZ Proxy upgrade pattern](https://docs.openzeppelin.com/upgrades-plugins/proxies); [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967); [Writing upgradeable contracts](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)).
- `_disableInitializers()` в конструкторе implementation; storage layout проверять плагином OZ.
- Nomad 2022: после апгрейда нулевой root считался доверенным (официальный постмортем Nomad на Medium недоступен нам — 403, не обходили; см. [rekt](https://rekt.news/nomad-rekt/)).

## 6. Логика и арифметика
- Euler 2023: функция `donateToReserves` без проверки здоровья позиции ([Euler/rekt](https://rekt.news/euler-rekt/)).
- KyberSwap 2023: ошибка точности/округления в тиках ([rekt](https://rekt.news/kyberswap-rekt/)).
- Округлять в пользу протокола; fuzz/invariant-тесты (Foundry) ([Foundry invariant testing](https://book.getfoundry.sh/forge/invariant-testing)).

## 7. Подписи
- EIP-712 с доменом (chainId, verifyingContract), nonce, deadline ([EIP-712](https://eips.ethereum.org/EIPS/eip-712)); permit ([EIP-2612](https://eips.ethereum.org/EIPS/eip-2612)); Permit2 ([Uniswap docs](https://docs.uniswap.org/contracts/permit2/overview)).
- Signature phishing (drainers): по Scam Sniffer, в 2024 году $494 млн украдено у 332 тыс. адресов ([Scam Sniffer](https://drops.scamsniffer.io/scam-sniffer-2024-web3-phishing-attacks-wallet-drainers-drain-494-million/)). Для вашего фронта: никогда не просить подпись `permit`/`setApprovalForAll` без явного объяснения; не запрашивать бесконечный approve.

## 8. Фронтенд, DNS, домен
- Curve 2022: DNS-хайджек фронтенда, ~$575k ([rekt](https://rekt.news/curve-finance-rekt/)); BadgerDAO 2021: вредоносный скрипт во фронтенде запрашивал approvals (>$50M) ([rekt](https://rekt.news/badger-rekt/)); Ledger Connect Kit 2023 (см. `04-supply-chain.md`).
- Меры: registrar lock, 2FA-ключи у регистратора и Cloudflare, DNSSEC, CSP + SRI, мониторинг изменений DNS и собранного бандла.

## 9. Solana — базовые проверки
- Проверять владельца аккаунта, signer, PDA seeds/bump, тип аккаунта (discriminator), sysvar-адреса ([Anchor constraints](https://www.anchor-lang.com/docs/references/account-constraints); [sealevel-attacks](https://github.com/coral-xyz/sealevel-attacks); [Helius: Solana security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security)).
- Wormhole 2022: адрес sysvar не проверялся → обход проверки подписей, $326M ([rekt](https://rekt.news/wormhole-rekt/)).

## 10. Процесс
- Тесты + fuzz/invariant + статанализ ([Slither](https://github.com/crytic/slither)) + внешний аудит + bug bounty + мониторинг + пауза/лимиты вывода.
- Аудит не гарантия: Euler, Nomad, KyberSwap были аудированы (см. постмортемы). Trail of Bits: автоматизация ловит не всё ([ToB](https://blog.trailofbits.com/2019/08/08/246-findings-from-our-smart-contract-audits-an-executive-summary/)).
- Пример контракта: `examples/solidity/SafeVault.sol`.

## Что делать / чего не делать

**Делать**
- Ключи — в аппаратных кошельках и мультисиге с timelock; проверять calldata на независимом устройстве.
- CEI + ReentrancyGuard, роли OZ, `_disableInitializers()`.
- Проверять свежесть и часы работы оракула (критично для RWA).
- Fuzz/invariant-тесты, Slither, внешний аудит до TVL.
- Защищать DNS/регистратор/CDN как часть смарт-контракта.

**Не делать**
- Не хранить приватный ключ в `.env`, репозитории, промпте агента или CI.
- Не использовать спот-цены DEX как оракул.
- Не запрашивать у пользователей бесконечные approve и непрозрачные подписи.
- Не считать аудит гарантией безопасности.
