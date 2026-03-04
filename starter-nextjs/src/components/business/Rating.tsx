interface RatingProps {
  value: number;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function Rating({ value, size = "md" }: RatingProps) {
  if (!value && value !== 0) return null;

  const starSize = sizes[size];
  // Convert from 0-10 scale to 0-5 stars
  const stars = (value / 10) * 5;
  const fullStars = Math.floor(stars);
  const hasHalf = stars - fullStars >= 0.25 && stars - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <svg
            key={`full-${i}`}
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill="var(--color-brand-accent, #F59E0B)"
            stroke="none"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
        {hasHalf && (
          <svg
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            stroke="none"
          >
            <defs>
              <clipPath id={`half-${value}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="var(--color-brand-accent, #F59E0B)"
              clipPath={`url(#half-${value})`}
            />
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="var(--color-brand-accent, #F59E0B)"
              strokeWidth="1.5"
            />
          </svg>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <svg
            key={`empty-${i}`}
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-brand-accent, #F59E0B)"
            strokeWidth="1.5"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        {value}/10
      </span>
    </div>
  );
}
