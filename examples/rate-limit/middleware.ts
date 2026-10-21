/**
 * Express-middleware: применяет решение AbuseGate к любому эндпоинту.
 * Shadow-режим: запрос «успешен», но без побочных эффектов / с урезанными данными / медленно.
 */
import type { Request, Response, NextFunction } from "express";
import type { AbuseGate, Actor } from "./abuse-gate";
import { subnetKey, type RequestSignals } from "./signals";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { actor?: Actor; abuseShadow?: boolean; }
  }
}

export function abuseMiddleware(gate: AbuseGate, endpoint: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // req.ip корректен только при правильном `trust proxy` (иначе X-Forwarded-For подделывается)
    const ip = req.ip ?? "0.0.0.0";
    const sig: RequestSignals = {
      ip,
      subnet: subnetKey(ip),
      fingerprint: (req.header("x-visitor-id") ?? undefined) as string | undefined, // подпишите на сервере, не доверяйте сырому значению
      userAgent: req.header("user-agent") ?? undefined,
    };
    try {
      const r = await gate.check(endpoint, sig, req.actor ?? {});
      req.log?.info?.({ endpoint, decision: r.decision, reason: r.reason }, "abuse_gate");
      switch (r.decision) {
        case "allow":
          return next();
        case "throttle":
          res.setHeader("Retry-After", Math.ceil(r.retryAfterMs / 1000));
          return res.status(429).json({ error: "rate_limited" });
        case "challenge":
          return res.status(403).json({ error: "challenge_required", challenge: "turnstile" });
        case "shadow":
          req.abuseShadow = true; // обработчик сам решает, что «тихо» не делать
          await new Promise((r) => setTimeout(r, 1500));
          return next();
        case "deny":
          return res.status(429).json({ error: "rate_limited" }); // не раскрываем причину
      }
    } catch (e) {
      // Политика при недоступности Redis: для дорогих эндпоинтов — fail-closed
      req.log?.error?.({ e }, "abuse_gate_error");
      return res.status(503).json({ error: "temporarily_unavailable" });
    }
  };
}

declare module "express-serve-static-core" {
  interface Request { log?: { info?: (o: object, m: string) => void; error?: (o: object, m: string) => void } }
}
