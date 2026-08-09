"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutosaveDraftRecord,
  AutosaveDraftSnapshot,
  AutosaveWorkspace
} from "@/lib/autosaveDrafts";

export type AutosaveStatus =
  | "loading"
  | "idle"
  | "saving"
  | "saved"
  | "local"
  | "conflict";

type LocalAutosaveRecord = AutosaveDraftRecord & {
  key: string;
  userEmail: string;
  savedAt: string;
};

type AutosaveResponse = {
  draft?: AutosaveDraftRecord | null;
  message?: string;
};

type UseAutosaveDraftOptions<T extends AutosaveDraftSnapshot> = {
  workspace: AutosaveWorkspace;
  scope: string;
  userEmail: string | null;
  value: T;
  enabled?: boolean;
  onRestore: (snapshot: T) => void;
};

const databaseName = "iniu-commercial-planning-autosave-v1";
const storeName = "drafts";
const localStoragePrefix = "iniu-autosave-draft:";
const idleSyncDelay = 1200;
const maximumSyncDelay = 10_000;

function makeLocalKey(userEmail: string, workspace: string, scope: string) {
  return `${userEmail.toLowerCase()}:${workspace}:${scope}`;
}

function recordTimestamp(record: Pick<AutosaveDraftRecord, "updatedAt"> | null) {
  if (!record) return 0;
  const timestamp = new Date(record.updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function pickNewestAutosaveDraft<T extends AutosaveDraftRecord>(
  local: T | null,
  remote: T | null
) {
  return recordTimestamp(local) >= recordTimestamp(remote) ? local : remote;
}

function sameSnapshot(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function openDraftDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readLocalRecord(key: string): Promise<LocalAutosaveRecord | null> {
  const database = await openDraftDatabase();
  if (!database) {
    try {
      const raw = window.localStorage.getItem(`${localStoragePrefix}${key}`);
      return raw ? (JSON.parse(raw) as LocalAutosaveRecord) : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as LocalAutosaveRecord | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeLocalRecord(record: LocalAutosaveRecord) {
  const database = await openDraftDatabase();
  if (!database) {
    try {
      window.localStorage.setItem(`${localStoragePrefix}${record.key}`, JSON.stringify(record));
    } catch {
      // The input remains in React state even if browser storage is unavailable.
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

async function removeLocalRecord(key: string) {
  const database = await openDraftDatabase();
  if (!database) {
    try {
      window.localStorage.removeItem(`${localStoragePrefix}${key}`);
    } catch {
      // Nothing else to clean up.
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function isRecord(value: unknown): value is AutosaveDraftSnapshot {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function useAutosaveDraft<T extends AutosaveDraftSnapshot>({
  workspace,
  scope,
  userEmail,
  value,
  enabled = true,
  onRestore
}: UseAutosaveDraftOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflictDraft, setConflictDraft] = useState<AutosaveDraftRecord | null>(null);
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const valueJson = useMemo(() => JSON.stringify(value), [value]);
  const onRestoreRef = useRef(onRestore);
  const initializedRef = useRef(false);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const firstDirtyAtRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestInFlightRef = useRef(false);
  const currentKeyRef = useRef("");
  const valueRef = useRef(value);
  const lastStoredValueJsonRef = useRef("");
  const applyingRestoreRef = useRef(false);

  onRestoreRef.current = onRestore;
  valueRef.current = value;

  const key = useMemo(
    () => (userEmail ? makeLocalKey(userEmail, workspace, scope) : ""),
    [scope, userEmail, workspace]
  );

  const clearTimers = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    syncTimerRef.current = null;
    retryTimerRef.current = null;
  }, []);

  const writeCurrentValueLocally = useCallback(
    async (override?: Partial<Pick<AutosaveDraftRecord, "revision" | "updatedAt" | "expiresAt">>) => {
      if (!key || !userEmail || !enabled) return;
      const now = new Date();
      await writeLocalRecord({
        key,
        userEmail: userEmail.toLowerCase(),
        workspace,
        scope,
        snapshot: valueRef.current,
        revision: override?.revision ?? revisionRef.current,
        updatedAt: override?.updatedAt ?? now.toISOString(),
        expiresAt:
          override?.expiresAt ??
          new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        savedAt: now.toISOString()
      });
    },
    [enabled, key, scope, userEmail, workspace]
  );

  const syncToServer = useCallback(
    async (force = false, ignoreRecovery = false): Promise<boolean> => {
      if (
        !enabled ||
        !key ||
        !userEmail ||
        !initializedRef.current ||
        (conflictDraft && !ignoreRecovery) ||
        requestInFlightRef.current ||
        !dirtyRef.current
      ) {
        return false;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("local");
        return false;
      }

      requestInFlightRef.current = true;
      setStatus("saving");
      try {
        const response = await fetch("/api/autosave-drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace,
            scope,
            snapshot: valueRef.current,
            baseRevision: revisionRef.current,
            force
          })
        });
        const payload = (await response.json().catch(() => ({}))) as AutosaveResponse;
        if (response.status === 409 && payload.draft) {
          setConflictDraft(payload.draft);
          setStatus("conflict");
          return false;
        }
        if (!response.ok || !payload.draft) {
          setStatus("local");
          return false;
        }

        revisionRef.current = payload.draft.revision;
        dirtyRef.current = false;
        firstDirtyAtRef.current = null;
        lastStoredValueJsonRef.current = JSON.stringify(valueRef.current);
        setLastSavedAt(payload.draft.updatedAt);
        setStatus("saved");
        await writeCurrentValueLocally(payload.draft);
        return true;
      } catch {
        setStatus("local");
        return false;
      } finally {
        requestInFlightRef.current = false;
      }
    },
    [conflictDraft, enabled, key, scope, userEmail, workspace, writeCurrentValueLocally]
  );

  const scheduleSync = useCallback(() => {
    if (!enabled || !initializedRef.current || conflictDraft) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const now = Date.now();
    const firstDirtyAt = firstDirtyAtRef.current ?? now;
    firstDirtyAtRef.current = firstDirtyAt;
    const delay = Math.max(0, Math.min(idleSyncDelay, maximumSyncDelay - (now - firstDirtyAt)));
    syncTimerRef.current = setTimeout(() => {
      void syncToServer().then((saved) => {
        if (!saved && dirtyRef.current && !conflictDraft) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => scheduleSync(), 5000);
        }
      });
    }, delay);
  }, [conflictDraft, enabled, syncToServer]);

  useEffect(() => {
    clearTimers();
    initializedRef.current = false;
    revisionRef.current = 0;
    lastStoredValueJsonRef.current = "";
    dirtyRef.current = false;
    firstDirtyAtRef.current = null;
    applyingRestoreRef.current = false;
    currentKeyRef.current = key;
    setConflictDraft(null);

    if (!enabled || !key || !userEmail) {
      setStatus("idle");
      initializedRef.current = true;
      return;
    }

    let cancelled = false;
    const initialValueJson = JSON.stringify(valueRef.current);
    setStatus("loading");
    void (async () => {
      const [localDraft, remoteResponse] = await Promise.all([
        readLocalRecord(key),
        fetch(
          `/api/autosave-drafts?workspace=${encodeURIComponent(workspace)}&scope=${encodeURIComponent(scope)}`
        )
          .then(async (response) => {
            if (!response.ok) return null;
            const payload = (await response.json()) as AutosaveResponse;
            return payload.draft ?? null;
          })
          .catch(() => null)
      ]);
      if (cancelled || currentKeyRef.current !== key) return;

      const localExpiresAt = localDraft ? new Date(localDraft.expiresAt).getTime() : 0;
      const local =
        localDraft?.userEmail === userEmail.toLowerCase() &&
        Number.isFinite(localExpiresAt) &&
        localExpiresAt > Date.now()
          ? localDraft
          : null;
      if (localDraft && !local) {
        void removeLocalRecord(key);
      }
      const remote = remoteResponse;
      const newest = pickNewestAutosaveDraft(local, remote);
      const current = valueRef.current;
      if (newest) {
        revisionRef.current = newest.revision;
        setLastSavedAt(newest.updatedAt);
        lastStoredValueJsonRef.current = JSON.stringify(newest.snapshot);
        if (!sameSnapshot(newest.snapshot, current)) {
          applyingRestoreRef.current = true;
          onRestoreRef.current(newest.snapshot as T);
        }
        const localNeedsSync =
          newest === local && (!remote || !sameSnapshot(local.snapshot, remote.snapshot));
        dirtyRef.current = localNeedsSync;
        firstDirtyAtRef.current = localNeedsSync ? Date.now() : null;
        setStatus(localNeedsSync ? "local" : "saved");
      } else {
        lastStoredValueJsonRef.current = initialValueJson;
        setStatus("idle");
      }
      // Keep the value from the beginning of hydration as the baseline. If the
      // user typed while we were reading local/server state, the next effect
      // records that newer input instead of silently treating it as initial UI.
      initializedRef.current = true;
      setHydrationVersion((currentVersion) => currentVersion + 1);
      if (dirtyRef.current) scheduleSync();
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [clearTimers, enabled, key, scheduleSync, scope, userEmail, workspace]);

  useEffect(() => {
    if (!enabled || !key || !initializedRef.current || conflictDraft) return;
    if (applyingRestoreRef.current) {
      if (valueJson === lastStoredValueJsonRef.current) {
        applyingRestoreRef.current = false;
      }
      return;
    }
    if (valueJson === lastStoredValueJsonRef.current) return;
    dirtyRef.current = true;
    void writeCurrentValueLocally();
    scheduleSync();
  }, [
    enabled,
    hydrationVersion,
    key,
    conflictDraft,
    scheduleSync,
    valueJson,
    writeCurrentValueLocally
  ]);

  useEffect(() => {
    const retryWhenOnline = () => {
      if (dirtyRef.current && !conflictDraft) scheduleSync();
    };
    const persistOnBackground = () => {
      if (dirtyRef.current) void writeCurrentValueLocally();
    };
    window.addEventListener("online", retryWhenOnline);
    document.addEventListener("visibilitychange", persistOnBackground);
    return () => {
      window.removeEventListener("online", retryWhenOnline);
      document.removeEventListener("visibilitychange", persistOnBackground);
    };
  }, [conflictDraft, scheduleSync, writeCurrentValueLocally]);

  const loadNewestSavedDraft = useCallback(() => {
    if (!conflictDraft || !isRecord(conflictDraft.snapshot)) return;
    revisionRef.current = conflictDraft.revision;
    dirtyRef.current = false;
    firstDirtyAtRef.current = null;
    lastStoredValueJsonRef.current = JSON.stringify(conflictDraft.snapshot);
    setLastSavedAt(conflictDraft.updatedAt);
    setConflictDraft(null);
    setStatus("saved");
    onRestoreRef.current(conflictDraft.snapshot as T);
  }, [conflictDraft]);

  const keepMyChanges = useCallback(async () => {
    if (!conflictDraft) return;
    setConflictDraft(null);
    dirtyRef.current = true;
    const saved = await syncToServer(true, true);
    if (!saved) setStatus("local");
  }, [conflictDraft, syncToServer]);

  const clearAutosaveDraft = useCallback(async () => {
    if (!key) return;
    clearTimers();
    dirtyRef.current = false;
    firstDirtyAtRef.current = null;
    revisionRef.current = 0;
    lastStoredValueJsonRef.current = JSON.stringify(valueRef.current);
    setConflictDraft(null);
    await removeLocalRecord(key);
    try {
      await fetch(
        `/api/autosave-drafts?workspace=${encodeURIComponent(workspace)}&scope=${encodeURIComponent(scope)}`,
        { method: "DELETE" }
      );
    } finally {
      setStatus("idle");
      setLastSavedAt(null);
    }
  }, [clearTimers, key, scope, workspace]);

  return {
    status,
    lastSavedAt,
    conflictDraft,
    loadNewestSavedDraft,
    keepMyChanges,
    clearAutosaveDraft
  };
}
