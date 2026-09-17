import { EmpireArcade, type ArcadeGame } from '../components/empire-arcade';
import '../components/arcade.css';

export interface ArcadeScreenProps {
  playerCash?: number;
  onReward?: (amount: number) => void;
  onCashUpdated?: (newCash: number) => void;
  preview?: boolean;
  initialGame?: ArcadeGame;
  referralLink?: string;
  clanTag?: string;
  clanName?: string;
}

export function ArcadeScreen({
  playerCash = 1000,
  onReward,
  onCashUpdated,
  preview = false,
  initialGame = 'tap',
  referralLink,
  clanTag,
  clanName,
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
        playerCash={playerCash}
        {...(onReward ? { onPreviewReward: onReward } : {})}
        {...(onCashUpdated ? { onCashUpdated } : {})}
        {...(referralLink ? { referralLink } : {})}
        {...(clanTag ? { clanTag } : {})}
        {...(clanName ? { clanName } : {})}
      />
    </div>
  );
}
