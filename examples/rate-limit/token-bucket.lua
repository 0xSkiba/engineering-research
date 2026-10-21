-- Атомарный token bucket для Redis (вызывается через EVALSHA).
-- KEYS[1]  = ключ ведра, например "rl:signup:ip:203.0.113.7"
-- ARGV[1]  = capacity      (макс. токенов, «всплеск»)
-- ARGV[2]  = refill_per_s  (токенов в секунду)
-- ARGV[3]  = cost          (стоимость запроса в токенах; дорогие эндпоинты > 1)
-- ARGV[4]  = now_ms        (время сервера приложения, мс)
-- Возвращает {allowed(0/1), remaining_tokens*1000, retry_after_ms}
local key        = KEYS[1]
local capacity   = tonumber(ARGV[1])
local refill     = tonumber(ARGV[2])
local cost       = tonumber(ARGV[3])
local now        = tonumber(ARGV[4])

local state  = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts     = tonumber(state[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

-- пополнение
local elapsed = math.max(0, now - ts) / 1000.0
tokens = math.min(capacity, tokens + elapsed * refill)

local allowed = 0
local retry_after_ms = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry_after_ms = math.ceil((cost - tokens) / refill * 1000)
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now)
-- TTL = время полного пополнения + запас, чтобы ключи не копились
redis.call('PEXPIRE', key, math.ceil(capacity / refill * 1000) + 60000)

return { allowed, math.floor(tokens * 1000), retry_after_ms }
