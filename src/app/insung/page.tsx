'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlayerDisplayName } from '@/utils/playerNames';

type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';

const PLAYERS: PlayerCode[] = ['잡', '큐', '지', '머', '웅'];
const PAGE_SIZE = 30;
const TOP_LIMIT = 10;

type Quote = {
  _id: string;
  content: string;
  author: PlayerCode;
  context?: string;
  saidAt?: string;
  registrant: PlayerCode;
  voteCount: number;
  createdAt: string;
  voters: PlayerCode[];
  myVote: boolean;
};

type LeaderboardRow = { player: PlayerCode; score: number; quoteCount: number; rank: number };
type AuthStatus = { me: PlayerCode | null; players: Array<{ player: PlayerCode; hasPin: boolean }> };

type Tab = 'ranking' | 'latest' | 'top';
type FeedSort = 'latest' | 'top';

const getKstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const formatDate = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

async function api<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string; body: any }> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body.success, data: body.data, error: body.error, body };
}

export default function InsungPage() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const [tab, setTab] = useState<Tab>('ranking');
  const [authorFilter, setAuthorFilter] = useState<PlayerCode | null>(null);
  const [feedSort, setFeedSort] = useState<FeedSort>('latest');

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const [content, setContent] = useState('');
  const [author, setAuthor] = useState<PlayerCode | null>(null);
  const [context, setContext] = useState('');
  const [saidAt, setSaidAt] = useState(getKstToday());
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const me = auth?.me ?? null;

  const showError = (text?: string) => setMessage({ type: 'error', text: text || '오류가 발생했습니다.' });
  const showSuccess = (text: string) => setMessage({ type: 'success', text });

  const fetchAuth = useCallback(async () => {
    const result = await api<AuthStatus>('/api/insung/auth/status');
    if (result.ok && result.data) setAuth(result.data);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const result = await api<LeaderboardRow[]>('/api/insung/leaderboard');
    if (result.ok && result.data) setLeaderboard(result.data);
  }, []);

  // 현재 보기(탭/작성자 필터/정렬)에 맞는 멘트 목록
  const feedQuery = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (authorFilter) {
        params.set('author', authorFilter);
        params.set('sort', feedSort);
      } else {
        params.set('sort', tab === 'top' ? 'top' : 'latest');
      }
      params.set('limit', String(tab === 'top' && !authorFilter ? TOP_LIMIT : PAGE_SIZE));
      params.set('offset', String(offset));
      return `/api/insung/quotes?${params.toString()}`;
    },
    [authorFilter, feedSort, tab]
  );

  const fetchQuotes = useCallback(
    async (append = false) => {
      setQuotesLoading(true);
      const result = await api<{ quotes: Quote[]; hasMore: boolean }>(feedQuery(append ? quotes.length : 0));
      setQuotesLoading(false);
      if (!result.ok || !result.data) return showError(result.error);
      const loaded = result.data.quotes;
      setQuotes((prev) => (append ? [...prev, ...loaded] : loaded));
      setHasMore(tab === 'top' && !authorFilter ? false : result.data.hasMore);
    },
    [feedQuery, quotes.length, tab, authorFilter]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchLeaderboard(), tab !== 'ranking' || authorFilter ? fetchQuotes() : null]);
  }, [fetchLeaderboard, fetchQuotes, tab, authorFilter]);

  useEffect(() => {
    fetchAuth();
    fetchLeaderboard();
  }, [fetchAuth, fetchLeaderboard]);

  useEffect(() => {
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  }, [tab, authorFilter, feedSort]);

  const requireLogin = () => {
    if (me) return true;
    setLoginOpen(true);
    return false;
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setContent(text);
    } catch {
      showError('클립보드를 읽을 수 없습니다. 입력창에 직접 붙여넣어 주세요.');
    }
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!requireLogin()) return;
    if (!content.trim()) return showError('멘트를 입력하세요.');
    if (!author) return showError('누가 한 말인지 선택하세요.');

    setSubmitting(true);
    const result = await api<{ status: 'created' | 'merged' | 'duplicate' }>('/api/insung/quotes', {
      method: 'POST',
      body: JSON.stringify({ content, author, context, saidAt })
    });
    setSubmitting(false);

    if (!result.ok || !result.data) {
      if (result.body?.requiresLogin) setLoginOpen(true);
      return showError(result.error);
    }

    const status = result.data.status;
    if (status === 'duplicate') {
      showSuccess('이미 등록된 멘트예요.');
    } else {
      showSuccess(status === 'merged' ? '이미 등록된 멘트라 투표로 반영했어요.' : '인성질 멘트가 등록되었습니다.');
      setContent('');
      setContext('');
      setAuthor(null);
      setSaidAt(getKstToday());
    }
    refreshAll();
  };

  const handleToggleVote = async (quote: Quote) => {
    setMessage(null);
    if (!requireLogin()) return;
    const result = await api(`/api/insung/quotes/${quote._id}/vote`, {
      method: quote.myVote ? 'DELETE' : 'POST'
    });
    if (!result.ok) showError(result.error);
    refreshAll();
  };

  const handleDelete = async (quote: Quote) => {
    setMessage(null);
    const isRegistrant = me === quote.registrant;
    let adminPassword: string | undefined;
    if (isRegistrant) {
      if (!window.confirm('이 멘트를 삭제할까요? 받은 투표도 함께 사라집니다.')) return;
    } else {
      adminPassword = window.prompt('관리자 비밀번호를 입력하세요.') ?? undefined;
      if (!adminPassword) return;
    }
    const result = await api(`/api/insung/quotes/${quote._id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminPassword })
    });
    if (!result.ok) return showError(result.error);
    showSuccess('멘트가 삭제되었습니다.');
    refreshAll();
  };

  const handleLogout = async () => {
    await api('/api/insung/auth/logout', { method: 'POST' });
    await fetchAuth();
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  };

  const handleLoggedIn = async () => {
    setLoginOpen(false);
    await fetchAuth();
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  };

  const selectTab = (next: Tab) => {
    setAuthorFilter(null);
    setTab(next);
  };

  const openAuthor = (player: PlayerCode) => {
    setFeedSort('latest');
    setAuthorFilter(player);
  };

  const showFeed = tab !== 'ranking' || authorFilter !== null;

  return (
    <main className="min-h-screen bg-page py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">뚱팸 인성질 랭킹</h1>
            <p className="text-sm text-muted mt-1">카톡에서 나온 인성질 멘트를 박제하고 투표합니다.</p>
          </div>
          <Link
            href="/"
            className="shrink-0 px-4 py-2 rounded-lg text-sm text-foreground hover:bg-surface-hover border border-border"
          >
            홈으로
          </Link>
        </div>

        <div className="flex items-center justify-between bg-surface rounded-lg border border-border px-4 py-3 text-sm">
          {me ? (
            <>
              <span className="text-foreground">
                <span className="font-semibold">{getPlayerDisplayName(me)}</span>
                <span className="text-muted">(으)로 접속 중</span>
              </span>
              <button type="button" onClick={handleLogout} className="text-muted hover:text-accent">
                로그아웃
              </button>
            </>
          ) : (
            <>
              <span className="text-muted">등록하거나 투표하려면 로그인하세요.</span>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="px-3 py-1.5 rounded-md bg-accent-gradient text-white font-semibold"
              >
                로그인
              </button>
            </>
          )}
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === 'error' ? 'border-danger text-danger' : 'border-success text-success'
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="bg-surface rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">인성질 멘트 등록</h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="insung-content" className="text-sm text-muted">
                멘트 ({content.trim().length}/500)
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="text-xs px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-surface-hover"
              >
                📋 붙여넣기
              </button>
            </div>
            <textarea
              id="insung-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="카톡에서 복사한 멘트를 붙여넣으세요"
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div>
            <p className="text-sm text-muted mb-2">누가 한 말인가요?</p>
            <div className="grid grid-cols-5 gap-2">
              {PLAYERS.map((player) => (
                <button
                  key={player}
                  type="button"
                  onClick={() => setAuthor(player)}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    author === player
                      ? 'bg-accent-gradient text-white border-transparent'
                      : 'border-border text-foreground hover:bg-surface-hover'
                  }`}
                >
                  {getPlayerDisplayName(player)}
                </button>
              ))}
            </div>
            {author && me && author === me && (
              <p className="text-xs text-muted mt-2">자수는 0점에서 시작합니다. 다른 사람이 투표하면 점수가 올라요.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={100}
              placeholder="상황 메모 (선택)"
              className="rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <input
              type="date"
              value={saidAt}
              max={getKstToday()}
              onChange={(e) => setSaidAt(e.target.value)}
              aria-label="발언 날짜"
              className="rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-accent-gradient text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '박제하기 (+1)'}
          </button>
        </section>

        <section className="bg-surface rounded-lg border border-border p-5">
          <div className="flex gap-2 mb-4">
            {(
              [
                ['ranking', '랭킹'],
                ['latest', '최신'],
                ['top', '레전드 TOP']
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${
                  tab === key && !authorFilter
                    ? 'bg-accent-gradient text-white border-transparent'
                    : 'border-border text-foreground hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {authorFilter && (
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">{getPlayerDisplayName(authorFilter)}의 인성질 모음</h2>
              <div className="flex gap-1 text-xs">
                {(
                  [
                    ['latest', '최신순'],
                    ['top', '투표순']
                  ] as Array<[FeedSort, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFeedSort(key)}
                    className={`px-2 py-1 rounded border ${
                      feedSort === key ? 'border-accent text-accent' : 'border-border text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!showFeed ? (
            !leaderboard ? (
              <p className="text-sm text-muted">랭킹을 불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((row) => (
                  <button
                    key={row.player}
                    type="button"
                    onClick={() => openAuthor(row.player)}
                    className="w-full bg-surface-hover rounded-lg px-3 py-3 flex items-center justify-between text-left hover:brightness-110"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {row.rank === 1 && row.score > 0 ? '👑 ' : ''}
                      {row.rank}위 {getPlayerDisplayName(row.player)}
                      <span className="text-xs text-muted ml-2">멘트 {row.quoteCount}개</span>
                    </span>
                    <span className="text-xl font-bold text-accent inline-flex items-center">
                      <span className="mr-2">😈</span>
                      {row.score}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-muted pt-1">이름을 누르면 그 사람의 멘트를 모아봅니다.</p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {quotes.length === 0 && !quotesLoading && (
                <p className="text-sm text-muted">아직 등록된 멘트가 없습니다.</p>
              )}
              {quotes.map((quote, index) => (
                <QuoteCard
                  key={quote._id}
                  quote={quote}
                  me={me}
                  rankLabel={tab === 'top' && !authorFilter ? `${index + 1}` : undefined}
                  onToggleVote={() => handleToggleVote(quote)}
                  onDelete={() => handleDelete(quote)}
                />
              ))}
              {quotesLoading && <p className="text-sm text-muted">불러오는 중...</p>}
              {hasMore && !quotesLoading && (
                <button
                  type="button"
                  onClick={() => fetchQuotes(true)}
                  className="w-full py-2 rounded-lg border border-border text-sm text-foreground hover:bg-surface-hover"
                >
                  더 보기
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {loginOpen && auth && (
        <LoginModal players={auth.players} onClose={() => setLoginOpen(false)} onLoggedIn={handleLoggedIn} onReset={fetchAuth} />
      )}
    </main>
  );
}

function QuoteCard({
  quote,
  me,
  rankLabel,
  onToggleVote,
  onDelete
}: {
  quote: Quote;
  me: PlayerCode | null;
  rankLabel?: string;
  onToggleVote: () => void;
  onDelete: () => void;
}) {
  const isOwnQuote = me === quote.author;
  return (
    <div className="bg-surface-hover rounded-lg px-4 py-3">
      <div className="flex items-start gap-3">
        {rankLabel && <span className="text-lg font-bold text-accent w-6 shrink-0">{rankLabel}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-foreground whitespace-pre-wrap break-words">“{quote.content}”</p>
          <p className="text-sm font-semibold text-foreground mt-2">— {getPlayerDisplayName(quote.author)}</p>
          {quote.context && <p className="text-xs text-muted mt-1">상황: {quote.context}</p>}
          <p className="text-xs text-muted mt-1">
            {quote.saidAt ? `${quote.saidAt.replace(/-/g, '.')} 발언 · ` : ''}
            {getPlayerDisplayName(quote.registrant)} 등록 · {formatDate(quote.createdAt)}
          </p>
          {quote.voters.length > 0 && (
            <p className="text-xs text-muted mt-1">👍 {quote.voters.map(getPlayerDisplayName).join(', ')}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleVote}
            disabled={isOwnQuote}
            title={isOwnQuote ? '본인 멘트에는 투표할 수 없습니다' : quote.myVote ? '투표 취소' : '공감 +1'}
            className={`min-w-14 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              quote.myVote
                ? 'bg-accent-gradient text-white border-transparent'
                : 'border-border text-foreground hover:bg-surface'
            }`}
          >
            👍 {quote.voteCount}
          </button>
          <button type="button" onClick={onDelete} className="text-xs text-muted hover:text-danger">
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginModal({
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
    const result = await api(`/api/insung/auth/${isSetup ? 'setup' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify({ player, pin })
    });
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
    const result = await api('/api/insung/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ player, adminPassword })
    });
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
            ✕
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
