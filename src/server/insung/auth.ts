import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import InsungUser from '@/models/InsungUser';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';

export const INSUNG_SESSION_COOKIE = 'insung_session';
const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const SESSION_SECRET_ENV = 'INSUNG_SESSION_SECRET';
const ADMIN_PASSWORD_ENV = 'RECORD_SUBMISSION_OVERRIDE_PASSWORD';

export const PIN_PATTERN = /^\d{4}$/;
export const MAX_PIN_FAILURES = 5;
export const PIN_LOCK_MINUTES = 10;

type SessionPayload = { p: PlayerCode; v: number; exp: number };

export const isValidPlayer = (value: unknown): value is PlayerCode =>
  typeof value === 'string' && (VALID_PLAYERS as readonly string[]).includes(value);

export const jsonError = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status });

const getSessionSecret = (): string => {
  const secret = process.env[SESSION_SECRET_ENV];
  if (!secret || secret.length < 32) {
    throw new Error(`${SESSION_SECRET_ENV} 환경변수(32자 이상)가 설정되지 않았습니다.`);
  }
  return secret;
};

const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// === PIN 해시 ===

export function hashPin(pin: string): { pinHash: string; pinSalt: string } {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.scryptSync(pin, pinSalt, 64).toString('hex');
  return { pinHash, pinSalt };
}

export function verifyPin(pin: string, pinHash: string, pinSalt: string): boolean {
  const candidate = crypto.scryptSync(pin, pinSalt, 64).toString('hex');
  return safeEqual(candidate, pinHash);
}

// === 세션 쿠키 (HMAC 서명) ===

const sign = (data: string) =>
  crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');

export function setSessionCookie(response: NextResponse, player: PlayerCode, pinVersion: number) {
  const payload: SessionPayload = {
    p: player,
    v: pinVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  response.cookies.set(INSUNG_SESSION_COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(INSUNG_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

const parseSessionToken = (token: string): SessionPayload | null => {
  const [data, signature] = token.split('.');
  if (!data || !signature || !safeEqual(sign(data), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    if (!isValidPlayer(payload.p) || typeof payload.v !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

/** 쿠키 서명·만료·pinVersion까지 확인한 현재 사용자. DB 연결 후 호출할 것. */
export async function getSessionPlayer(): Promise<PlayerCode | null> {
  const token = (await cookies()).get(INSUNG_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = parseSessionToken(token);
  if (!payload) return null;

  const user = await InsungUser.findOne({ player: payload.p }).select({ pinHash: 1, pinVersion: 1 });
  if (!user?.pinHash || user.pinVersion !== payload.v) return null;
  return payload.p;
}

// === 관리자 비밀번호 ===

export function isAdminPassword(password: unknown): boolean {
  const expected = process.env[ADMIN_PASSWORD_ENV];
  return Boolean(expected) && typeof password === 'string' && safeEqual(password, expected as string);
}
