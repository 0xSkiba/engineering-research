# Смарт-контракты (Solidity/EVM + основы Solana)

> Уверенность: **H** для фактов из документации и постмортемов; **M** для приоритизации. Аудит профессионалами — обязателен для контрактов с деньгами; этот файл его не заменяет.

## Почему здесь всё иначе
- Код неизменяем (или изменяем через прокси — что само по себе риск), ошибки = прямые потери средств, атакующий может взять flash loan на сотни миллионов на одну транзакцию.
- По оценке Chainalysis, в 2025 г. украдено более $3.4 млрд, из них на КНДР — $2.02 млрд ([Chainalysis](https://www.chainalysis.com/blog/crypto-hacking-stolen-funds-2026/)). Крупнейшие потери часто — **не баг Solidity, а компрометация ключей/подписантов/инфраструктуры** (Bybit, Ronin, WazirX, Radiant — см. `05-security-mistakes/06-crypto-hack-postmortems.md`).

## OWASP Smart Contract Top 10 (2026)
SC01 Access Control · SC02 Business Logic · SC03 Price Oracle Manipulation · SC04 Flash Loan–Facilitated Attacks · SC05 Lack of Input Validation · SC06 Unchecked External Calls · SC07 Arithmetic Errors · SC08 Reentrancy · SC09 Integer Overflow/Underflow · SC10 Proxy & Upgradeability ([OWASP SC Top 10](https://scs.owasp.org/sctop10/)). Старый реестр слабостей: [SWC Registry](https://swcregistry.io/).

## EVM: ключевые правила
1. **Checks-Effects-Interactions** + `ReentrancyGuard` ([Solidity security considerations](https://docs.soliditylang.org/en/latest/security-considerations.html); [OZ ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard)). Reentrancy — не только при отправке ETH (там же); есть read-only reentrancy и даже баг компилятора: Vyper 0.2.15/0.2.16/0.3.0 с неработающим `nonreentrant` → Curve-пулы, ~$69M ([rekt: Curve/Vyper](https://rekt.news/curve-vyper-rekt/)). Хронология атак: [pcaversaccio/reentrancy-attacks](https://github.com/pcaversaccio/reentrancy-attacks).
2. **Контроль доступа** на каждой привилегированной функции (`AccessControl`/`Ownable2Step`), роли минимальны ([OZ Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control)). Нет `tx.origin` для авторизации.
3. **Оракулы**: не использовать spot-цену одного пула (Inverse Finance — манипуляция TWAP малоликвидной пары, ~$15.6M: [rekt](https://rekt.news/inverse-finance-rekt/); Mango Markets — манипуляция ценой собственного токена, $115M долга: [rekt](https://rekt.news/mango-markets-rekt/), [CFTC](https://www.cftc.gov/PressRoom/PressReleases/8647-23)). Использовать устойчивые фиды, проверять свежесть и границы, учитывать торговые часы для фидов на акции ([Chainlink](https://docs.chain.link/data-feeds/selecting-data-feeds); [Uniswap oracle](https://docs.uniswap.org/concepts/protocol/oracle); [Chainlink: market manipulation vs oracle exploits](https://chain.link/education-hub/market-manipulation-vs-oracle-exploits); [flash loans & oracles](https://chain.link/education-hub/flash-loans)).
4. **Каждая функция, меняющая баланс, проверяет инварианты.** Euler ($197M): `donateToReserves` не проверял здоровье позиции ([rekt: Euler](https://rekt.news/euler-rekt/); [Euler recovery](https://www.euler.finance/blog/war-peace-behind-the-scenes-of-eulers-240m-exploit-recovery)).
5. **Прокси/апгрейды**: нельзя конструкторы → `initializer`; защищать инициализацию; не ломать storage layout; слоты по EIP-1967 ([OZ: Writing upgradeable](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable); [OZ Proxies](https://docs.openzeppelin.com/upgrades-plugins/proxies); [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)). Классика: Parity multisig — неинициализированная библиотека, которую «убили» ([OpenZeppelin: Parity Wallet Hack Reloaded](https://www.openzeppelin.com/news/parity-wallet-hack-reloaded); [issue #6995](https://github.com/openethereum/parity-ethereum/issues/6995); [OpenZeppelin разбор](https://blog.openzeppelin.com/on-the-parity-wallet-multisig-hack-405a8c12e8f7)). Nomad ($190M): апгрейд сделал `0x00` доверенным корнем ([rekt: Nomad](https://rekt.news/nomad-rekt/)).
6. **Governance**: задержка исполнения (timelock) обязательна — Beanstalk ($181M) потерял средства из-за flash-loan голосования без задержки ([rekt: Beanstalk](https://rekt.news/beanstalk-rekt/)).
7. **Подписи**: EIP-712 typed data, nonce, deadline, chainId, domain separator ([EIP-712](https://eips.ethereum.org/EIPS/eip-712); [EIP-2612 permit](https://eips.ethereum.org/EIPS/eip-2612); [Permit2](https://docs.uniswap.org/contracts/permit2/overview)). Подписи `permit` — главный инструмент дрейнеров (см. `05-security-mistakes/05-crypto-specific.md`).
8. **Арифметика/точность**: Solidity ≥0.8 проверяет переполнение, но `unchecked`, деление до умножения и округление в пользу пользователя остаются (KyberSwap Elastic, >$48M — precision error, манипуляция тиками и двойной учёт ликвидности: [rekt](https://rekt.news/kyberswap-rekt/)).
9. **Тестирование**: Foundry unit + fuzz + **invariant** ([Foundry invariant testing](https://book.getfoundry.sh/forge/invariant-testing)), Echidna ([echidna](https://github.com/crytic/echidna)), Slither ([slither](https://github.com/crytic/slither)). Trail of Bits (246 находок): ~78% самых важных багов, вероятно, ловятся автоматическим статическим/динамическим анализом, но почти 50% всех находок автоматикой не найти; ручные unit-тесты дают слабую защиту от того, что находит аудитор ([ToB](https://blog.trailofbits.com/2019/08/08/246-findings-from-our-smart-contract-audits-an-executive-summary/)).
10. **Админ-ключи = мультисиг + аппаратные кошельки + проверка calldata вне UI** (Bybit, WazirX, Radiant). [Safe docs](https://docs.safe.global/home/what-is-safe).

Пример: `examples/solidity/SafeVault.sol`.

## Solana: базовые классы ошибок
- Модель аккаунтов: программа получает аккаунты извне и **обязана проверять владельца, подписанта, тип и связь** ([Solana accounts](https://solana.com/docs/core/accounts)).
- Типовые уязвимости: Missing Ownership Check, Missing Signer Check, Account Data Matching, Arbitrary CPI, Type Cosplay, PDA misuse/sharing, Closing Accounts ([Helius: Solana program security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security); примеры кода: [coral-xyz/sealevel-attacks](https://github.com/coral-xyz/sealevel-attacks)).
- Anchor автоматизирует многие проверки через ограничения аккаунтов ([Anchor docs](https://www.anchor-lang.com/docs)).
- Wormhole ($326M): не проверялся адрес sysvar-аккаунта инструкций → обход проверки подписей guardians ([rekt: Wormhole](https://rekt.news/wormhole-rekt/)).

## Что делать / чего не делать

**Делать**
- CEI + ReentrancyGuard на всех внешних вызовах; роли и timelock на админ-функциях.
- Fuzz + invariant-тесты; Slither в CI; внешний аудит перед деплоем с деньгами; bug bounty после.
- Для оракулов: несколько источников/устойчивый фид, проверка `updatedAt`, границы отклонения, учёт часов торгов.
- Мультисиг с аппаратными ключами и независимой проверкой calldata для всех админ-операций.

**Не делать**
- Не использовать spot-цену AMM как оракул.
- Не оставлять контракт-реализацию неинициализированной; не менять порядок storage-переменных при апгрейде.
- Не давать AI-агенту деплоить в mainnet или иметь доступ к приватным ключам.
- Не считать, что «аудит был» = «безопасно»: по rekt.news, Euler проходил аудиты шести аудиторов, Nomad — аудит Quantstamp, KyberSwap Elastic тоже был аудирован ([Euler](https://rekt.news/euler-rekt/), [Nomad](https://rekt.news/nomad-rekt/), [KyberSwap](https://rekt.news/kyberswap-rekt/)).
