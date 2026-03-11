interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const color =
    score >= 7.5
      ? 'bg-score-good text-white'
      : score >= 6
        ? 'bg-score-mid text-white'
        : 'bg-score-bad text-white';

  const sizeClass = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  }[size];

  return (
    <span className={`${color} ${sizeClass} rounded-md font-button font-semibold`}>
      {score.toFixed(1)}
    </span>
  );
}
