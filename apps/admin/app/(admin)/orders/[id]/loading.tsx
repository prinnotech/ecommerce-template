import { DetailSkeleton } from "@repo/admin-ui/components/skeletons";

// Below the guarded layout, so the auth redirect still happens before streaming.
export default function Loading() {
  return <DetailSkeleton />;
}
