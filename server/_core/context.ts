import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { getUserByOpenId } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const NHS_COOKIE = "nhs_audit_session";

async function verifyNhsToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.openId as string) ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const rawCookies = opts.req.headers.cookie ?? "";
    const match = rawCookies
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(NHS_COOKIE + "="));
    const token = match ? match.slice(NHS_COOKIE.length + 1) : undefined;
    if (token) {
      const openId = await verifyNhsToken(token);
      if (openId) {
        user = (await getUserByOpenId(openId)) ?? null;
      }
    }
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
