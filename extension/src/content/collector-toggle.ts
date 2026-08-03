export const COLLECTOR_ENABLED_KEY = "collectorEnabled";

export type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown }>,
  areaName: string,
) => void;

type Dependencies = {
  storage: { get: (key: string) => Promise<Record<string, unknown>> };
  changes: {
    addListener: (listener: StorageChangeListener) => void;
    removeListener: (listener: StorageChangeListener) => void;
  };
  install: () => () => void;
};

export async function installCollectorToggle(
  dependencies: Dependencies,
): Promise<() => void> {
  let stopButtons: (() => void) | undefined;
  const apply = (enabled: boolean) => {
    stopButtons?.();
    stopButtons = enabled ? dependencies.install() : undefined;
  };
  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local" || !(COLLECTOR_ENABLED_KEY in changes)) return;
    apply(changes[COLLECTOR_ENABLED_KEY].newValue !== false);
  };
  const stored = await dependencies.storage
    .get(COLLECTOR_ENABLED_KEY)
    .catch(() => ({}));
  apply(stored[COLLECTOR_ENABLED_KEY] !== false);
  dependencies.changes.addListener(listener);
  return () => {
    dependencies.changes.removeListener(listener);
    stopButtons?.();
  };
}
