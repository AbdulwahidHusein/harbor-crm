import { Skeleton } from "@/components/ui/skeleton";

const ProfileSkeleton = () => (
  <div className="flex-1 space-y-6 p-8 pt-6">
    <div className="w-full h-32 rounded-lg border border-border flex items-center px-8 gap-6">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
    <div className="flex gap-6">
      <div className="w-48 space-y-1 flex-shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-4">
        <div className="space-y-3 p-4 border rounded-lg">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-3 p-4 border rounded-lg">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  </div>
);

export default ProfileSkeleton;
