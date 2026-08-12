import { SkeletonBox, SkeletonCircle } from '../Skeleton';

const BUBBLE_WIDTHS = ['40%', '55%', '30%', '48%', '35%', '60%'];

export default function ChatThreadSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col gap-3">
      {BUBBLE_WIDTHS.map((width, i) => {
        const isOwn = i % 3 === 1;
        return (
          <div key={i} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!isOwn && <SkeletonCircle size={28} />}
            <SkeletonBox className="h-10" style={{ width, maxWidth: '70%' }} />
          </div>
        );
      })}
    </div>
  );
}

export function ChatHeaderSkeleton() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
      <SkeletonCircle size={36} />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonBox className="h-3.5" style={{ width: '35%' }} />
        <SkeletonBox className="h-2.5" style={{ width: '20%' }} />
      </div>
    </header>
  );
}
