export function MapSkeleton() {
  return (
    <div className="skeleton-map">
      <div className="skeleton-shimmer" />
      <div className="skeleton-pins">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="skeleton-pin" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="list-wrap">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton-line w-60" />
          <div className="skeleton-line w-40" />
          <div className="skeleton-row">
            <span className="skeleton-tag" />
            <span className="skeleton-tag" />
          </div>
        </div>
      ))}
    </div>
  );
}
