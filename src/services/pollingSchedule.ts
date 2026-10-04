import { getSettings, setScanStatus } from './storage';
import { getRequestCooldown } from './requestPacing';

export const POLL_ALARM = 'floatr-poll';
let scheduleWrites: Promise<unknown> = Promise.resolve();

/** Repair missing alarms without postponing an existing scheduled scan. */
export function syncPollingAlarm(): Promise<void> {
  const write = scheduleWrites.then(async () => {
    const settings = await getSettings();
    const minutes = Number.isFinite(settings.pollIntervalMinutes)
      ? Math.max(1, Math.min(60, settings.pollIntervalMinutes)) : 3;
    if (!settings.enabled) {
      await chrome.alarms.clear(POLL_ALARM);
      await setScanStatus({ nextScanAt: null });
      return;
    }
    let alarm = await chrome.alarms.get(POLL_ALARM);
    const cooldownUntil = await getRequestCooldown();
    if (!alarm || alarm.periodInMinutes !== minutes || alarm.scheduledTime < cooldownUntil) {
      await chrome.alarms.create(POLL_ALARM, {
        when: Math.max(Date.now() + minutes * 60_000, cooldownUntil),
        periodInMinutes: minutes,
      });
      alarm = await chrome.alarms.get(POLL_ALARM);
    }
    await setScanStatus({ nextScanAt: alarm?.scheduledTime ?? null });
  });
  scheduleWrites = write.catch(() => undefined);
  return write;
}
