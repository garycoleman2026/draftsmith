export function isDueWiseOldManSync(input: { autoSync: boolean; groupId: number | null; eventStatus: string; nextSyncAt: string | null }, now = Date.now()) {
  return input.autoSync && Boolean(input.groupId) && input.eventStatus === 'live'
    && Boolean(input.nextSyncAt && Date.parse(input.nextSyncAt) <= now);
}
