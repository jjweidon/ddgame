'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlayerDisplayName } from '@/utils/playerNames';
import Icon from '@/components/Icon';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';

type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';

const PLAYERS: PlayerCode[] = ['잡', '큐', '지', '머', '웅'];
const PAGE_SIZE = 30;
const TOP_LIMIT = 10;
const POINT_LEVELS = Array.from({ length: INSUNG_POINT_MAX - INSUNG_POINT_MIN + 1 }, (_, i) => INSUNG_POINT_MIN + i);

type Quote = {
  _id: string;
  content: string;
  author: PlayerCode;
  context?: string;
  saidAt?: string;
  registrant: PlayerCode;
  voteCount: number;
  pointTotal: number;
  createdAt: string;
  voters: Array<{ player: PlayerCode; points: number }>;
  myPoints: number; // 0이면 투표 안 함
};

type QuoteEditFields = { content: string; author: PlayerCode; context: string; saidAt: string };

type PointBudget = { month: string; granted: number; carriedOver: number; spent: number; remaining: number };

type LeaderboardRow = { player: PlayerCode; score: number; quoteCount: number; rank: number };
type AuthStatus = { me: PlayerCode | null; players: Array<{ player: PlayerCode; hasPin: boolean }> };

type Tab = 'ranking' | 'top' | 'latest' | 'voted';
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
  const [feedSort, setFeedSort] = useState<FeedSort>('top');

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const [content, setContent] = useState('');
  const [author, setAuthor] = useState<PlayerCode | null>(null);
  const [context, setContext] = useState('');
  const [saidAt, setSaidAt] = useState(getKstToday());
  const [points, setPoints] = useState(INSUNG_POINT_MIN);
  const [submitting, setSubmitting] = useState(false);
  const [budget, setBudget] = useState<PointBudget | null>(null);

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const me = auth?.me ?? null;

  const showError = (text?: string) => setMessage({ type: 'error', text: text || '오류가 발생했습니다.' });
  const showSuccess = (text: string) => setMessage({ type: 'success', text });

  const fetchAuth = useCallback(async () => {
    const result = await api<AuthStatus>('/api/insung/auth/status');
    if (result.ok && result.data) setAuth(result.data);
  }, []);

  const fetchBudget = useCallback(async () => {
    const result = await api<PointBudget | null>('/api/insung/budget');
    if (result.ok) setBudget(result.data ?? null);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const result = await api<LeaderboardRow[]>('/api/insung/leaderboard');
    if (result.ok && result.data) setLeaderboard(result.data);
  }, []);

  // 현재 보기(탭/주인공 필터/정렬)에 맞는 제보 목록
  const feedQuery = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (authorFilter) {
        params.set('author', authorFilter);
        params.set('sort', feedSort);
      } else if (tab === 'voted') {
        params.set('voted', 'me');
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
      // 내 투표 탭은 로그인해야 볼 수 있음
      if (tab === 'voted' && !authorFilter && !me) {
        setQuotes([]);
        setHasMore(false);
        return;
      }
      setQuotesLoading(true);
      const result = await api<{ quotes: Quote[]; hasMore: boolean }>(feedQuery(append ? quotes.length : 0));
      setQuotesLoading(false);
      if (!result.ok || !result.data) return showError(result.error);
      const loaded = result.data.quotes;
      setQuotes((prev) => (append ? [...prev, ...loaded] : loaded));
      setHasMore(tab === 'top' && !authorFilter ? false : result.data.hasMore);
    },
    [feedQuery, quotes.length, tab, authorFilter, me]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchLeaderboard(),
      fetchBudget(),
      tab !== 'ranking' || authorFilter ? fetchQuotes() : null
    ]);
  }, [fetchLeaderboard, fetchBudget, fetchQuotes, tab, authorFilter]);

  useEffect(() => {
    fetchAuth();
    fetchLeaderboard();
    fetchBudget();
  }, [fetchAuth, fetchLeaderboard, fetchBudget]);

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
    if (!content.trim()) return showError('무슨 말이나 행동을 했는지 입력하세요.');
    if (!author) return showError('누가 했는지 선택하세요.');

    setSubmitting(true);
    const result = await api<{ status: 'created' | 'merged' | 'duplicate' }>('/api/insung/quotes', {
      method: 'POST',
      body: JSON.stringify({ content, author, context, saidAt, points })
    });
    setSubmitting(false);

    if (!result.ok || !result.data) {
      if (result.body?.requiresLogin) setLoginOpen(true);
      return showError(result.error);
    }

    const status = result.data.status;
    if (status === 'duplicate') {
      showSuccess('이미 등록된 제보예요.');
    } else {
      showSuccess(status === 'merged' ? '이미 등록된 제보라 투표로 반영했어요.' : '인성질 제보가 등록되었습니다.');
      setContent('');
      setContext('');
      setAuthor(null);
      setSaidAt(getKstToday());
      setPoints(INSUNG_POINT_MIN);
    }
    refreshAll();
  };

  // 같은 점수를 다시 누르면 취소, 다른 점수면 투표·변경
  const handleVote = async (quote: Quote, selected: number) => {
    setMessage(null);
    if (!requireLogin()) return;
    const cancel = quote.myPoints === selected;
    const result = await api(`/api/insung/quotes/${quote._id}/vote`, {
      method: cancel ? 'DELETE' : 'POST',
      body: cancel ? undefined : JSON.stringify({ points: selected })
    });
    if (!result.ok) showError(result.error);
    refreshAll();
  };

  const handleEdit = async (quote: Quote, fields: QuoteEditFields) => {
    setMessage(null);
    const result = await api(`/api/insung/quotes/${quote._id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields)
    });
    if (!result.ok) {
      showError(result.error);
      return false;
    }
    showSuccess('제보가 수정되었습니다.');
    refreshAll();
    return true;
  };

  const handleDelete = async (quote: Quote) => {
    setMessage(null);
    const isRegistrant = me === quote.registrant;
    let adminPassword: string | undefined;
    if (isRegistrant) {
      if (!window.confirm('이 제보를 삭제할까요? 이 제보에 준 포인트는 모두 돌려줍니다.')) return;
    } else {
      adminPassword = window.prompt('관리자 비밀번호를 입력하세요.') ?? undefined;
      if (!adminPassword) return;
    }
    const result = await api(`/api/insung/quotes/${quote._id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminPassword })
    });
    if (!result.ok) return showError(result.error);
    showSuccess('제보가 삭제되었습니다.');
    refreshAll();
  };

  const handleLogout = async () => {
    await api('/api/insung/auth/logout', { method: 'POST' });
    await fetchAuth();
    setBudget(null);
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  };

  const handleLoggedIn = async () => {
    setLoginOpen(false);
    await fetchAuth();
    fetchBudget();
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  };

  // 사람별 모음·내 투표는 포인트순이 기본
  const selectTab = (next: Tab) => {
    setAuthorFilter(null);
    setFeedSort('top');
    setTab(next);
  };

  const openAuthor = (player: PlayerCode) => {
    setFeedSort('top');
    setAuthorFilter(player);
  };

  const showFeed = tab !== 'ranking' || authorFilter !== null;
  const remaining = budget?.remaining ?? INSUNG_POINT_MAX;

  return (
    <main className="min-h-screen bg-page py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">뚱팸 인성질 랭킹</h1>
            <p className="text-sm text-muted mt-1">말이든 행동이든, 친구들의 인성질을 제보하고 투표합니다.</p>
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
              <span className="flex items-center gap-3">
                {budget && (
                  <span className="text-foreground" title="이번 달 남은 포인트 / 이번 달 받은 포인트(이월 포함)">
                    <Icon name="star" filled className="inline w-4 h-4 -mt-0.5 mr-1 text-warning" />
                    <span className="font-semibold text-accent">{budget.remaining}</span>
                    <span className="text-muted"> / {budget.granted + budget.carriedOver}</span>
                    {budget.carriedOver > 0 && <span className="text-xs text-muted"> (+{budget.carriedOver} 이월)</span>}
                  </span>
                )}
                <button type="button" onClick={handleLogout} className="text-muted hover:text-accent">
                  로그아웃
                </button>
              </span>
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
          <h2 className="text-xl font-semibold text-foreground">인성질 제보</h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="insung-content" className="text-sm text-muted">
                무슨 일이 있었나요? ({content.trim().length}/500)
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-surface-hover"
              >
                <Icon name="clipboard" className="w-3.5 h-3.5" />
                붙여넣기
              </button>
            </div>
            <textarea
              id="insung-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={"한 말을 옮겨 적거나, 한 행동을 적어주세요\n예) 약속 30분 늦고 사과 한마디 없음"}
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div>
            <p className="text-sm text-muted mb-2">누가 했나요?</p>
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
          </div>

          <div>
            <p className="text-sm text-muted mb-1">몇 포인트를 줄까요?</p>
            <div className="flex items-center gap-3">
              <StarRating
                value={points}
                isOverBudget={(value) => value > remaining}
                onSelect={(value) => {
                  // 같은 칸을 다시 누르면 0 (투표 없이 등록)
                  if (value === points) return setPoints(0);
                  if (value > remaining) return showError(`포인트가 부족합니다. (이번 달 남은 포인트 ${remaining})`);
                  setPoints(value);
                }}
              />
              <span className="text-xs text-muted">{points > 0 ? `${points}포인트` : '투표 없이 등록'}</span>
            </div>
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
              // 입력칸 어디를 눌러도 달력이 열리도록 (지원 브라우저만)
              onClick={(e) => e.currentTarget.showPicker?.()}
              aria-label="발생 날짜"
              className="sm:w-44 cursor-pointer rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-accent-gradient text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {submitting ? '등록 중...' : points > 0 ? `박제하기 (+${points}점)` : '박제하기'}
          </button>
        </section>

        <section className="bg-surface rounded-lg border border-border p-5">
          <div className="flex gap-2 mb-4">
            {(
              [
                ['ranking', '랭킹'],
                ['top', 'TOP10'],
                ['latest', '최신'],
                ['voted', '내 투표']
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

          {(authorFilter || (tab === 'voted' && me)) && (
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">
                {authorFilter ? `${getPlayerDisplayName(authorFilter)}의 인성질 모음` : '내가 투표한 제보'}
              </h2>
              <div className="flex gap-1 text-xs">
                {(
                  [
                    ['top', '포인트순'],
                    ['latest', '최신순']
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
                    <span className="text-sm font-medium text-foreground inline-flex items-center gap-1">
                      {row.rank === 1 && row.score > 0 && <Icon name="crown" className="w-4 h-4 text-warning" />}
                      {row.rank}위 {getPlayerDisplayName(row.player)}
                      <span className="text-xs text-muted ml-2">제보 {row.quoteCount}개</span>
                    </span>
                    <span className="text-xl font-bold text-foreground inline-flex items-center gap-1.5">
                      <Icon name="star" filled className="w-4 h-4 text-warning" />
                      {row.score}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-muted pt-1">이름을 누르면 그 사람의 제보를 모아봅니다.</p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {tab === 'voted' && !authorFilter && !me ? (
                <p className="text-sm text-muted">
                  내가 투표한 제보를 보려면{' '}
                  <button type="button" onClick={() => setLoginOpen(true)} className="text-accent underline">
                    로그인
                  </button>
                  하세요.
                </p>
              ) : (
                quotes.length === 0 &&
                !quotesLoading && (
                  <p className="text-sm text-muted">
                    {tab === 'voted' && !authorFilter ? '아직 투표한 제보가 없습니다.' : '아직 등록된 제보가 없습니다.'}
                  </p>
                )
              )}
              {quotes.map((quote, index) => (
                <QuoteCard
                  key={quote._id}
                  quote={quote}
                  remaining={remaining}
                  rankLabel={tab === 'top' && !authorFilter ? `${index + 1}` : undefined}
                  isMine={me !== null && me === quote.registrant}
                  onVote={(selected) => handleVote(quote, selected)}
                  onEdit={(fields) => handleEdit(quote, fields)}
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

// 별점: 누른 칸까지 채워짐. 같은 칸 다시 누르기(취소/0) 처리는 부모가 결정
function StarRating({
  value,
  isOverBudget,
  onSelect
}: {
  value: number;
  isOverBudget: (value: number) => boolean;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="포인트">
      {POINT_LEVELS.map((level) => {
        const filled = level <= value;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onSelect(level)}
            aria-label={`${level}포인트`}
            aria-pressed={level === value}
            title={isOverBudget(level) && !filled ? '포인트 부족' : `${level}포인트`}
            className={`w-7 h-7 flex items-center justify-center transition-transform active:scale-90 ${
              filled
                ? 'text-warning'
                : isOverBudget(level)
                  ? 'text-muted opacity-30 cursor-not-allowed'
                  : 'text-muted hover:text-warning'
            }`}
          >
            <Icon name="star" filled={filled} className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
}

function QuoteCard({
  quote,
  remaining,
  rankLabel,
  isMine,
  onVote,
  onEdit,
  onDelete
}: {
  quote: Quote;
  remaining: number;
  rankLabel?: string;
  isMine: boolean;
  onVote: (points: number) => void;
  onEdit: (fields: QuoteEditFields) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuoteEditFields | null>(null);
  const [saving, setSaving] = useState(false);

  // 점수를 바꿀 때 필요한 포인트는 서버가 최종 판단 (지난달 투표는 새 점수 전부 차감)
  const exceedsBudget = (value: number) => value - quote.myPoints > remaining;

  const startEdit = () => {
    setDraft({
      content: quote.content,
      author: quote.author,
      context: quote.context ?? '',
      saidAt: quote.saidAt ?? ''
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await onEdit(draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing && draft) {
    const inputClass =
      'w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus';
    return (
      <div className="bg-surface-hover rounded-lg px-4 py-3 space-y-3">
        <textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          maxLength={500}
          rows={3}
          aria-label="본문"
          className={inputClass}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {PLAYERS.map((player) => (
            <button
              key={player}
              type="button"
              onClick={() => setDraft({ ...draft, author: player })}
              className={`py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                draft.author === player
                  ? 'border-accent text-accent'
                  : 'border-border text-foreground hover:bg-surface'
              }`}
            >
              {getPlayerDisplayName(player)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <input
            type="text"
            value={draft.context}
            onChange={(e) => setDraft({ ...draft, context: e.target.value })}
            maxLength={100}
            placeholder="상황 메모 (선택)"
            className={inputClass}
          />
          <input
            type="date"
            value={draft.saidAt}
            max={getKstToday()}
            onChange={(e) => setDraft({ ...draft, saidAt: e.target.value })}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="발생 날짜"
            className={`${inputClass} sm:w-44 cursor-pointer`}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 rounded-md text-sm border border-border text-foreground hover:bg-surface"
          >
            취소
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-semibold border border-accent text-accent hover:bg-surface disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-hover rounded-lg px-4 py-3">
      <div className="flex items-start gap-3">
        {rankLabel && <span className="text-lg font-bold text-accent w-6 shrink-0">{rankLabel}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-foreground whitespace-pre-wrap break-words">{quote.content}</p>
          <p className="text-sm font-semibold text-foreground mt-2">— {getPlayerDisplayName(quote.author)}</p>
          {quote.context && <p className="text-xs text-muted mt-1">상황: {quote.context}</p>}
          <p className="text-xs text-muted mt-1">
            {quote.saidAt ? `${quote.saidAt.replace(/-/g, '.')} 발생 · ` : ''}
            {getPlayerDisplayName(quote.registrant)} 등록 · {formatDate(quote.createdAt)}
          </p>
          {quote.voters.length > 0 && (
            <p className="text-xs text-muted mt-1">
              {quote.voters.map((voter) => `${getPlayerDisplayName(voter.player)} ${voter.points}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 text-xs">
          {isMine && (
            <button type="button" onClick={startEdit} className="text-muted hover:text-accent">
              수정
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title={isMine ? '삭제' : '관리자 비밀번호로 삭제'}
            className="text-muted hover:text-danger"
          >
            삭제
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StarRating value={quote.myPoints} isOverBudget={exceedsBudget} onSelect={onVote} />
        <span className="text-sm text-muted">
          <span className="font-semibold text-foreground">{quote.pointTotal}</span>점 · {quote.voteCount}명
        </span>
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
