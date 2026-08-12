import { SkeletonCircle, SkeletonBox } from '../Skeleton';

export default function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="w-full flex items-center gap-3 px-4 py-3">
          <SkeletonCircle size={44} />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <SkeletonBox className="h-3.5" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <SkeletonBox className="h-3" style={{ width: `${35 + ((i * 17) % 40)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
