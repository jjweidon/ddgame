'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getPlayerDisplayName } from '@/utils/playerNames';
import { josa } from '@/utils/korean';
import {
  PICKY_EATERS,
  PICKY_FOOD_NAME_MAX,
  PICKY_FOOD_NOTE_MAX,
  normalizeFoodName
} from '@/constants/pickyFood';

type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';

type Food = {
  _id: string;
  eater: PlayerCode;
  name: string;
  note?: string;
  createdAt: string;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

async function api<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body.success, data: body.data, error: body.error };
}

export default function PickyFoodPage() {
  const [eater, setEater] = useState<PlayerCode>(PICKY_EATERS[0]);
  const [foods, setFoods] = useState<Food[] | null>(null);
  const eaterRef = useRef(eater);

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const eaterName = getPlayerDisplayName(eater);

  const showError = (text?: string) => setMessage({ type: 'error', text: text || '오류가 발생했습니다.' });
  const showSuccess = (text: string) => setMessage({ type: 'success', text });

  const fetchFoods = useCallback(async () => {
    const result = await api<Food[]>(`/api/picky-foods?eater=${encodeURIComponent(eater)}`);
    if (!result.ok || !result.data) return showError(result.error);
    // 응답 도착 전에 대상자 탭을 바꾼 경우 이전 응답은 버림
    if (eaterRef.current !== eater) return;
    setFoods(result.data);
  }, [eater]);

  useEffect(() => {
    eaterRef.current = eater;
    setFoods(null);
    fetchFoods();
  }, [eater, fetchFoods]);

  const selectEater = (next: PlayerCode) => {
    if (next === eater) return;
    setMessage(null);
    setSearch('');
    setEater(next);
  };

  const visibleFoods = useMemo(() => {
    if (!foods) return [];
    const keyword = normalizeFoodName(search);
    if (!keyword) return foods;
    return foods.filter((food) => normalizeFoodName(food.name).includes(keyword));
  }, [foods, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) return showError('음식 이름을 입력하세요.');

    setSubmitting(true);
    const result = await api<Food>('/api/picky-foods', {
      method: 'POST',
      body: JSON.stringify({ eater, name, note })
    });
    setSubmitting(false);
    if (!result.ok) return showError(result.error);

    showSuccess(`'${name.trim()}' 추가 완료. 이것도 안 먹냐...`);
    setName('');
    setNote('');
    fetchFoods();
  };

  const handleDelete = async (food: Food) => {
    setMessage(null);
    const adminPassword = window.prompt(`'${food.name}'${josa(food.name, '을/를')} 삭제합니다. 관리자 비밀번호를 입력하세요.`);
    if (!adminPassword) return;
    const result = await api(`/api/picky-foods/${food._id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminPassword })
    });
    if (!result.ok) return showError(result.error);
    showSuccess('삭제되었습니다.');
    fetchFoods();
  };

  return (
    <main className="min-h-screen bg-page py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">{eaterName} 편식 도감</h1>
            <p className="text-sm text-muted mt-1">{eaterName}{josa(eaterName, '이/가')} 안 먹는 음식, 생각날 때마다 박제합니다.</p>
          </div>
          <Link
            href="/"
            className="shrink-0 px-4 py-2 rounded-lg text-sm text-foreground hover:bg-surface-hover border border-border"
          >
            홈으로
          </Link>
        </div>

        {/* 대상자가 2명 이상일 때만 탭 노출 */}
        {PICKY_EATERS.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {PICKY_EATERS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => selectEater(code)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  eater === code
                    ? 'bg-accent-gradient text-white border-transparent'
                    : 'border-border text-foreground hover:bg-surface-hover'
                }`}
              >
                {getPlayerDisplayName(code)}
              </button>
            ))}
          </div>
        )}

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === 'error' ? 'border-danger text-danger' : 'border-success text-success'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface rounded-lg border border-border p-5 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">안 먹는 음식 추가</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PICKY_FOOD_NAME_MAX}
              placeholder="음식 이름"
              aria-label="음식 이름"
              className="flex-1 min-w-0 rounded-lg border border-border bg-page px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <button
              type="submit"
              disabled={submitting}
              className="shrink-0 px-5 bg-accent-gradient text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {submitting ? '추가 중...' : '추가'}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={PICKY_FOOD_NOTE_MAX}
            placeholder="메모 (선택)"
            aria-label="메모"
            className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </form>

        <section className="bg-surface rounded-lg border border-border p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              안 먹는 음식 <span className="text-accent">{foods ? foods.length : '-'}</span>개
            </h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색"
              aria-label="음식 검색"
              className="w-full sm:w-44 rounded-lg border border-border bg-page px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          {!foods ? (
            <p className="text-sm text-muted">불러오는 중...</p>
          ) : visibleFoods.length === 0 ? (
            <p className="text-sm text-muted">
              {foods.length === 0 ? '아직 등록된 음식이 없습니다. 첫 번째 편식을 제보해 주세요.' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleFoods.map((food) => (
                <div key={food._id} className="bg-surface-hover rounded-lg px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground break-words">{food.name}</p>
                    {food.note && <p className="text-sm text-muted mt-0.5 break-words">{food.note}</p>}
                    <p className="text-xs text-muted mt-1">{formatDate(food.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(food)}
                    className="shrink-0 text-xs text-muted hover:text-danger"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
