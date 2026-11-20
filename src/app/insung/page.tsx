'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getPlayerDisplayName } from '@/utils/playerNames';
import Icon from '@/components/Icon';
import LoginModal from '@/components/LoginModal';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';

type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';

const PLAYERS: PlayerCode[] = ['잡', '큐', '지', '머', '웅'];
const PAGE_SIZE = 30;
const TOP_LIMIT = 10;
const VOTE_DEBOUNCE_MS = 600; // 별 연타는 마지막 값만 서버로 보냄
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
  voterPoints?: number; // 투표 이력 탭: 선택한 사람이 준 점수
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
  // 투표 이력 탭에서 고른 사람. null이면 나
  const [historyPick, setHistoryPick] = useState<PlayerCode | null>(null);
  const [voterBudget, setVoterBudget] = useState<PointBudget | null>(null);

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
  const historyVoter = historyPick ?? me;

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
        params.set('voted', historyVoter ?? 'me');
        params.set('sort', feedSort);
      } else {
        params.set('sort', tab === 'top' ? 'top' : 'latest');
      }
      params.set('limit', String(tab === 'top' && !authorFilter ? TOP_LIMIT : PAGE_SIZE));
      params.set('offset', String(offset));
      return `/api/insung/quotes?${params.toString()}`;
    },
    [authorFilter, feedSort, tab, historyVoter]
  );

  const fetchQuotes = useCallback(
    async (append = false) => {
      // 투표 이력 탭은 사람을 고르거나 로그인해야 볼 수 있음
      if (tab === 'voted' && !authorFilter && !historyVoter) {
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
    [feedQuery, quotes.length, tab, authorFilter, historyVoter]
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

  // 로그인·로그아웃하면 내 투표 상태(myPoints)가 바뀌므로 목록을 다시 부름
  useEffect(() => {
    if (tab !== 'ranking' || authorFilter) fetchQuotes();
  }, [tab, authorFilter, feedSort, historyVoter, me]);

  // 투표 이력 탭: 고른 사람의 이번 달 포인트 (나는 상단 budget을 그대로 씀)
  useEffect(() => {
    if (tab !== 'voted' || !historyVoter || historyVoter === me) return setVoterBudget(null);
    let cancelled = false;
    api<PointBudget>(`/api/insung/budget?player=${encodeURIComponent(historyVoter)}`).then((result) => {
      if (!cancelled && result.ok && result.data) setVoterBudget(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, historyVoter, me]);

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
  // 제보별로 연타 중인 투표: 처음 누르기 전 상태와 전송 타이머
  const pendingVotes = useRef(new Map<string, { original: Quote; timer: ReturnType<typeof setTimeout> }>());

  const replaceQuote = (next: Quote) =>
    setQuotes((prev) => prev.map((quote) => (quote._id === next._id ? next : quote)));

  const flushVote = async (quoteId: string, nextPoints: number) => {
    const pending = pendingVotes.current.get(quoteId);
    pendingVotes.current.delete(quoteId);
    if (!pending || pending.original.myPoints === nextPoints) return; // 원래 점수로 돌아왔으면 요청 안 함

    const cancel = nextPoints === 0;
    const result = await api<{ quote: Quote | null; budget: PointBudget }>(`/api/insung/quotes/${quoteId}/vote`, {
      method: cancel ? 'DELETE' : 'POST',
      body: cancel ? undefined : JSON.stringify({ points: nextPoints })
    });
    if (!result.ok || !result.data) {
      showError(result.error);
      replaceQuote(pending.original);
      fetchBudget();
      return;
    }
    if (result.data.quote) replaceQuote(result.data.quote);
    setBudget(result.data.budget);
  };

  // 누르면 화면에 바로 반영하고, 연타가 끝나면 마지막 값만 전송. 같은 칸을 다시 누르면 취소
  const handleVote = (quote: Quote, selected: number) => {
    setMessage(null);
    if (!requireLogin() || !me) return;
    const nextPoints = quote.myPoints === selected ? 0 : selected;
    const delta = nextPoints - quote.myPoints;
    if (budget && delta > budget.remaining) {
      return showError(`포인트가 부족합니다. (이번 달 남은 포인트 ${budget.remaining})`);
    }

    const pending = pendingVotes.current.get(quote._id);
    if (pending) clearTimeout(pending.timer);
    pendingVotes.current.set(quote._id, {
      original: pending?.original ?? quote,
      timer: setTimeout(() => flushVote(quote._id, nextPoints), VOTE_DEBOUNCE_MS)
    });

    const voters = quote.voters.filter((voter) => voter.player !== me);
    replaceQuote({
      ...quote,
      myPoints: nextPoints,
      pointTotal: quote.pointTotal + delta,
      voteCount: voters.length + (nextPoints > 0 ? 1 : 0),
      voters: nextPoints > 0 ? [...voters, { player: me, points: nextPoints }] : voters
    });
    setBudget((prev) => (prev ? { ...prev, spent: prev.spent + delta, remaining: prev.remaining - delta } : prev));
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
  };

  const handleLoggedIn = async () => {
    setLoginOpen(false);
    await fetchAuth();
    fetchBudget();
  };

  // 사람별 모음·투표 이력은 포인트순이 기본. 투표 이력은 나부터 보여줌
  const selectTab = (next: Tab) => {
    // 투표는 랭킹을 다시 부르지 않으므로 랭킹 탭으로 올 때 갱신
    if (next === 'ranking') fetchLeaderboard();
    setAuthorFilter(null);
    setFeedSort('top');
    setHistoryPick(null);
    setTab(next);
  };

  const pickHistoryVoter = (player: PlayerCode) => {
    if (player === historyVoter) return;
    setQuotes([]);
    setHistoryPick(player);
  };

  const openAuthor = (player: PlayerCode) => {
    setFeedSort('top');
    setAuthorFilter(player);
  };

  const showFeed = tab !== 'ranking' || authorFilter !== null;
  const remaining = budget?.remaining ?? INSUNG_POINT_MAX;
  const showHistory = tab === 'voted' && !authorFilter;
  const historyBudget = historyVoter && historyVoter === me ? budget : voterBudget;

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
                ['voted', '투표 이력']
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

          {showHistory && (
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {PLAYERS.map((player) => (
                  <button
                    key={player}
                    type="button"
                    onClick={() => pickHistoryVoter(player)}
                    className={`px-2.5 py-1 rounded-md text-sm border transition-colors ${
                      historyVoter === player
                        ? 'border-accent text-accent font-semibold'
                        : 'border-border text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {getPlayerDisplayName(player)}
                    {player === me && <span className="text-xs text-muted ml-0.5">(나)</span>}
                  </button>
                ))}
              </div>
              {historyVoter && historyBudget && (
                <p className="text-sm text-muted inline-flex items-center gap-1.5">
                  남은 포인트
                  <Icon name="star" filled className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-accent">{historyBudget.remaining}</span>
                  <span>/ {historyBudget.granted + historyBudget.carriedOver}</span>
                  {historyBudget.carriedOver > 0 && <span className="text-xs">(+{historyBudget.carriedOver} 이월)</span>}
                </p>
              )}
            </div>
          )}

          {(authorFilter || (showHistory && historyVoter)) && (
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">
                {authorFilter
                  ? `${getPlayerDisplayName(authorFilter)}의 인성질 모음`
                  : historyVoter === me
                    ? '내가 투표한 제보'
                    : `${getPlayerDisplayName(historyVoter as PlayerCode)}이(가) 투표한 제보`}
              </h2>
              <div className="flex gap-1 text-xs">
                {(
                  [
                    ['top', showHistory ? '준 점수순' : '포인트순'],
                    ['latest', showHistory ? '최근 투표순' : '최신순']
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
              {showHistory && !historyVoter ? (
                <p className="text-sm text-muted">
                  볼 사람을 고르거나,{' '}
                  <button type="button" onClick={() => setLoginOpen(true)} className="text-accent underline">
                    로그인
                  </button>
                  해서 내 투표를 보세요.
                </p>
              ) : (
                quotes.length === 0 &&
                !quotesLoading && (
                  <p className="text-sm text-muted">
                    {showHistory ? '아직 투표한 제보가 없습니다.' : '아직 등록된 제보가 없습니다.'}
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
                  voterBadge={
                    showHistory && historyVoter && quote.voterPoints
                      ? { name: historyVoter === me ? '내가' : `${getPlayerDisplayName(historyVoter)}이(가)`, points: quote.voterPoints }
                      : undefined
                  }
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
  voterBadge,
  onVote,
  onEdit,
  onDelete
}: {
  quote: Quote;
  remaining: number;
  rankLabel?: string;
  isMine: boolean;
  voterBadge?: { name: string; points: number };
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
          {voterBadge && (
            <p className="text-xs text-muted mb-1 inline-flex items-center gap-1">
              {voterBadge.name} 준 점수
              <Icon name="star" filled className="w-3.5 h-3.5 text-warning" />
              <span className="font-semibold text-foreground">{voterBadge.points}</span>
            </p>
          )}
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
