// 외곽선 아이콘 모음. 경로는 Tabler Icons(MIT) 기준, 색은 currentColor를 따른다.
const ICON_PATHS = {
  alert: ['M12 9v4', 'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z', 'M12 16h.01'],
  bolt: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  calendar: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16'],
  chart: [
    'M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
    'M4 20h14'
  ],
  check: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 12l2 2l4 -4'],
  clipboard: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z'],
  close: ['M18 6l-12 12', 'M6 6l12 12'],
  crown: ['M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z'],
  diamond: ['M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5', 'M10 12l-2 -2.2l.6 -1'],
  flame: ['M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235'],
  gamepad: ['M2 8a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z', 'M6 12h4m-2 -2v4', 'M15 11l0 .01', 'M18 13l0 .01'],
  heartBroken: ['M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572', 'M12 6l-2 4l4 3l-2 4v3'],
  moodSad: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 10l.01 0', 'M15 10l.01 0', 'M9.5 15.25a3.5 3.5 0 0 1 5 0'],
  moodSmile: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 10l.01 0', 'M15 10l.01 0', 'M9.5 15a3.5 3.5 0 0 0 5 0'],
  sparkles: ['M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z'],
  star: ['M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z'],
  target: ['M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  trendingDown: ['M3 7l6 6l4 -4l8 8', 'M21 10l0 7l-7 0'],
  trendingUp: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
  trophy: ['M8 21l8 0', 'M12 17l0 4', 'M7 4l10 0', 'M17 4v8a5 5 0 0 1 -10 0v-8', 'M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0']
} as const;

export type IconName = keyof typeof ICON_PATHS;

export default function Icon({
  name,
  filled = false,
  className = 'w-5 h-5',
  strokeWidth = 2
}: {
  name: IconName;
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
