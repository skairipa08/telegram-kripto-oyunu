import { EmpireArcade, type ArcadeGame } from '../components/empire-arcade';
import '../components/arcade.css';

export interface ArcadeScreenProps {
  playerCash?: number;
  onReward?: (amount: number) => void;
  preview?: boolean;
  initialGame?: ArcadeGame;
}

export function ArcadeScreen({
  playerCash = 1000,
  onReward,
  preview = false,
  initialGame = 'tap',
}: ArcadeScreenProps) {
  return (
    <div
      className="arcade-screen workspace-grid"
      aria-label="Empire Arcade Salonu"
      data-player-cash={playerCash}
    >
      <EmpireArcade
        preview={preview}
        initialGame={initialGame}
        {...(onReward ? { onPreviewReward: onReward } : {})}
      />
    </div>
  );
}
