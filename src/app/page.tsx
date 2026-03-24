import Link from 'next/link';
const games = [
  {
    id: 'sequence',
    name: '시퀀스',
    description: '승률 기록 페이지로 이동',
    href: '/sequence',
    available: true,
  },
  {
    id: 'cartan',
    name: '카탄',
    description: '준비 중',
    href: '#',
    available: false,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-page py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground tracking-tight">
            뚱팸 승률 기록
          </h1>
          <p className="text-muted text-sm">게임을 선택해 승률 기록 페이지로 이동하세요</p>
        </div>

        <div className="space-y-4">
          {games.map((game) =>
            game.available ? (
              <Link
                key={game.id}
                href={game.href}
                className="block bg-surface rounded-lg border border-border p-5 transition-colors duration-200 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{game.name}</h2>
                    <p className="text-sm text-muted mt-1">{game.description}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            ) : (
              <div
                key={game.id}
                className="bg-surface rounded-lg border border-border p-5 opacity-70 cursor-not-allowed"
              >
                <h2 className="text-xl font-semibold text-foreground">{game.name}</h2>
                <p className="text-sm text-muted mt-1">{game.description}</p>
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}
