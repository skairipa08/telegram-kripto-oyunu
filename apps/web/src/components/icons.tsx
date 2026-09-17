import type { ReactNode } from 'react';

export type IconName =
  'empire' | 'arcade' | 'missions' | 'friends' | 'leaderboard' | 'shop';

const paths: Record<IconName, ReactNode> = {
  empire: <path d="M4 20V9l8-5 8 5v11M8 20v-8h8v8M10 20v-4h4v4" />,
  arcade: (
    <path d="M6 11h4m-2-2v4m7-2h.01M19 11h.01M17 15H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4Z" />
  ),
  missions: <path d="M9 5h10v15H5V5h2m2-2v4m6-4v4M8 11h8m-8 4h5" />,
  friends: (
    <>
      <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M17 11a3 3 0 0 0 0-6m4 15v-2a4 4 0 0 0-3-3.87" />
    </>
  ),
  leaderboard: <path d="M5 20v-6h4v6m2 0V4h4v16m2 0v-9h4v9M3 20h20" />,
  shop: <path d="m4 9 2-5h12l2 5M5 10v10h14V10M9 20v-6h6v6M3 9h18" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
