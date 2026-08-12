import { SkeletonBox, SkeletonCircle } from '../Skeleton';

export default function ProfileSkeleton() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0E1621] text-[#E9EDF0] p-6">
      <div className="w-full max-w-md flex flex-col gap-6 mt-10">
        <SkeletonBox className="h-7" style={{ width: '45%' }} />

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <SkeletonCircle size={96} />
          <SkeletonBox className="h-3.5" style={{ width: 90 }} />
        </div>

        {/* Info */}
        <div className="bg-[#17212B] rounded-xl p-4 flex flex-col gap-2">
          <SkeletonBox className="h-4" style={{ width: '50%' }} />
          <SkeletonBox className="h-3" style={{ width: '65%' }} />
        </div>

        {/* Bio editor */}
        <div className="flex flex-col gap-2">
          <SkeletonBox className="h-3" style={{ width: 30 }} />
          <SkeletonBox className="h-20 w-full" />
          <SkeletonBox className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
