'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { getPlayerDisplayName } from '@/utils/playerNames';

export type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';
export type AuthStatus = { me: PlayerCode | null; players: Array<{ player: PlayerCode; hasPin: boolean }> };

async function post(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body.success, error: body.error as string | undefined };
}

// 인성질 랭킹·사진첩이 함께 쓰는 PIN 로그인 모달 (세션 쿠키는 사이트 전체 공통)
export default function LoginModal({
  players,
  onClose,
  onLoggedIn,
  onReset
}: {
  players: AuthStatus['players'];
  onClose: () => void;
  onLoggedIn: () => void;
  onReset: () => void;
}) {
  const [player, setPlayer] = useState<PlayerCode | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasPin = player ? players.find((p) => p.player === player)?.hasPin ?? false : false;
  const isSetup = player !== null && !hasPin;

  const selectPlayer = (next: PlayerCode) => {
    setPlayer(next);
    setPin('');
    setPinConfirm('');
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;
    setError(null);
    if (!/^\d{4}$/.test(pin)) return setError('PIN은 숫자 4자리여야 합니다.');
    if (isSetup && pin !== pinConfirm) return setError('PIN 확인이 일치하지 않습니다.');

    setLoading(true);
    const result = await post(`/api/insung/auth/${isSetup ? 'setup' : 'login'}`, { player, pin });
    setLoading(false);
    if (!result.ok) {
      setPin('');
      return setError(result.error || '로그인에 실패했습니다.');
    }
    onLoggedIn();
  };

  const handleReset = async () => {
    if (!player) return;
    const adminPassword = window.prompt(`${getPlayerDisplayName(player)}의 PIN을 리셋합니다. 관리자 비밀번호를 입력하세요.`);
    if (!adminPassword) return;
    const result = await post('/api/insung/auth/reset', { player, adminPassword });
    if (!result.ok) return setError(result.error || 'PIN 리셋에 실패했습니다.');
    setNotice('PIN이 리셋되었습니다. 새 PIN을 설정하세요.');
    setError(null);
    onReset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface rounded-lg border border-border p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">누구세요?</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="닫기">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {players.map(({ player: code }) => (
            <button
              key={code}
              type="button"
              onClick={() => selectPlayer(code)}
              className={`py-2 rounded-lg text-sm font-semibold border ${
                player === code
                  ? 'bg-accent-gradient text-white border-transparent'
                  : 'border-border text-foreground hover:bg-surface-hover'
              }`}
            >
              {getPlayerDisplayName(code)}
            </button>
          ))}
        </div>

        {player && (
          <>
            <p className="text-sm text-muted">
              {isSetup
                ? '처음 접속했어요. 앞으로 사용할 PIN(숫자 4자리)을 설정하세요.'
                : 'PIN 4자리를 입력하세요.'}
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN"
              autoFocus
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-center tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
            {isSetup && (
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN 확인"
                className="w-full rounded-lg border border-border bg-page px-3 py-2 text-center tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
              />
            )}
            {notice && <p className="text-sm text-success">{notice}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-gradient text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? '확인 중...' : isSetup ? 'PIN 설정하고 시작' : '로그인'}
            </button>
            {!isSetup && (
              <button type="button" onClick={handleReset} className="w-full text-xs text-muted hover:text-accent">
                PIN을 잊었어요 (관리자 리셋)
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
