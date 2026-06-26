/** True when Supabase error indicates directory_status column is not migrated yet. */
export function isDirectoryStatusColumnMissing(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('directory_status') && (msg.includes('does not exist') || msg.includes('column'));
}
