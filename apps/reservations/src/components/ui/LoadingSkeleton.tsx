interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 5, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Carregando...">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex space-x-4">
          <div className="rounded-lg bg-gray-200 dark:bg-gray-700 h-12 w-24" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
