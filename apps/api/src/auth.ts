import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { config } from "./config.js";

const sessionPayload = z.object({
  email: z.string().email(),
  name: z.string(),
  exp: z.number(),
});

type SessionPayload = z.infer<typeof sessionPayload>;

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", config.investorSessionSecret)
    .update(value)
    .digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createInvestorSession(input: { email: string; name: string }) {
  if (!config.investorSessionSecret) {
    throw new Error("INVESTOR_SESSION_SECRET is not configured");
  }

  const payload: SessionPayload = {
    email: input.email,
    name: input.name,
    exp: Math.floor(Date.now() / 1000) + config.investorSessionTtlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyInvestorSession(token: string) {
  if (!config.investorSessionSecret) {
    throw new Error("INVESTOR_SESSION_SECRET is not configured");
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeCompare(sign(encodedPayload), signature)) {
    return null;
  }

  let decodedPayload: unknown;

  try {
    decodedPayload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }

  const payload = sessionPayload.safeParse(decodedPayload);

  if (!payload.success || payload.data.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload.data;
}

export function requireMerchantAccess(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!config.merchantApiKey) {
    response.status(500).json({ error: "MERCHANT_API_KEY is not configured" });
    return;
  }

  const providedKey = request.header("x-merchant-api-key") ?? "";

  if (!safeCompare(config.merchantApiKey, providedKey)) {
    response.status(401).json({ error: "Unauthorized merchant request" });
    return;
  }

  next();
}

export function requireInvestorSession(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const header = request.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = token ? verifyInvestorSession(token) : null;

  if (!session) {
    response.status(401).json({ error: "Investor session expired" });
    return;
  }

  response.locals.investorSession = session;
  next();
}

export function getInvestorSession(response: Response): SessionPayload {
  return response.locals.investorSession as SessionPayload;
}
