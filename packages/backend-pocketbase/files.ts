import { POCKETBASE_URL } from "@repo/backend-pocketbase/config";

type FileOwner = { collectionId: string; id: string };

// URL of a file stored in a PocketBase file field. `thumb` must be one of the field's thumb sizes.
export function getFileUrl(record: FileOwner, filename: string, thumb?: string): string {
  if (!filename) return "";
  const url = `${POCKETBASE_URL}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(filename)}`;
  return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url;
}
