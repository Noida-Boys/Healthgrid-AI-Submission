"use client";

import { useEffect, useState } from "react";
import { HAS_FIREBASE } from "@/hooks/useFacilities";
import type { NotificationTimestamp, OperationalNotification } from "@/lib/notifications/types";

function timestampMillis(value: NotificationTimestamp | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate().getTime();
    return value.seconds * 1000;
  }
  return 0;
}

function displayTimestamp(value: NotificationTimestamp | null | undefined): string {
  const milliseconds = timestampMillis(value);
  return milliseconds ? new Date(milliseconds).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Sending…";
}

export default function FieldNotificationInbox({ facilityId }: { facilityId: string }) {
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [loadedFacilityId, setLoadedFacilityId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      if (!HAS_FIREBASE) {
        setNotifications([]);
        setLoadedFacilityId(facilityId);
        return;
      }
      const [{ clientDb }, { collection, onSnapshot, query, where }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;
      unsubscribe = onSnapshot(
        query(collection(clientDb, "notifications"), where("facilityId", "==", facilityId)),
        (snapshot) => {
          setNotifications(
            snapshot.docs
              .map((item) => ({ ...item.data(), id: item.id }) as OperationalNotification)
              .filter((notification) => !notification.acknowledged)
              .sort((left, right) => timestampMillis(right.createdAt) - timestampMillis(left.createdAt)),
          );
          setLoadedFacilityId(facilityId);
          setError("");
        },
        () => {
          setLoadedFacilityId(facilityId);
          setError("Notifications could not be loaded. Check the connection and try again.");
        },
      );
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [facilityId]);

  async function performAction(notificationId: string, action: "read" | "acknowledge") {
    if (pendingIds.has(notificationId)) return;
    setPendingIds((current) => new Set(current).add(notificationId));
    try {
      const response = await fetch("/api/actions/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, action }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? await response.json() as { success?: boolean; error?: string }
        : null;
      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? `Notification could not be marked ${action} (HTTP ${response.status})`);
      }
      if (action === "acknowledge") {
        setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
        setOpenIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Notification update failed");
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  }

  function toggleOpen(notification: OperationalNotification) {
    const opening = !openIds.has(notification.id);
    setOpenIds((current) => {
      const next = new Set(current);
      if (opening) next.add(notification.id);
      else next.delete(notification.id);
      return next;
    });
    if (opening && !notification.read) void performAction(notification.id, "read");
  }

  const loading = loadedFacilityId !== facilityId;
  return (
    <section className="rounded-md border border-line bg-surface-1 p-4" aria-labelledby="field-notifications-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 id="field-notifications-title" className="text-sm font-semibold text-ink-1">Operational notifications</h2>
          <p className="text-[11px] text-ink-3 mt-0.5">District Command Centre instructions for this facility.</p>
        </div>
        {notifications.some((notification) => !notification.read) && (
          <span className="rounded bg-critical-dim px-2 py-1 text-[10px] font-medium text-critical">New</span>
        )}
      </div>

      {loading && <div className="text-xs text-ink-3">Loading notifications…</div>}
      {!loading && error && <div role="alert" className="mb-3 rounded border border-critical/50 bg-critical-dim px-3 py-2 text-xs text-critical">{error}</div>}
      {!loading && notifications.length === 0 && (
        <div className="rounded border border-dashed border-line px-3 py-5 text-center text-xs text-ink-3">No operational notifications for this facility.</div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const open = openIds.has(notification.id);
          const pending = pendingIds.has(notification.id);
          return (
            <article key={notification.id} className={`rounded border p-3 ${notification.read ? "border-line bg-surface-2/40" : "border-accent/60 bg-surface-2"}`}>
              <button type="button" onClick={() => toggleOpen(notification)} aria-expanded={open} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-1">{notification.title}</div>
                    <div className="mt-1 text-[10px] text-ink-3">{displayTimestamp(notification.createdAt)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${notification.priority === "critical" ? "bg-critical-dim text-critical" : "bg-at-risk-dim text-at-risk"}`}>
                      {notification.priority}
                    </span>
                    <div className="mt-1 text-[10px] text-ink-3">{open ? "Hide" : "Open"}</div>
                  </div>
                </div>
              </button>

              {open && (
                <div className="mt-3 border-t border-line pt-3">
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-ink-2">{notification.report}</pre>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-ink-3">
                      {notification.acknowledged
                        ? `Acknowledged ${displayTimestamp(notification.acknowledgedAt)}`
                        : notification.read
                          ? `Read ${displayTimestamp(notification.readAt)}`
                          : "Unread"}
                    </div>
                    <button
                      type="button"
                      disabled={notification.acknowledged || pending}
                      onClick={() => void performAction(notification.id, "acknowledge")}
                      className="rounded bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notification.acknowledged ? "Acknowledged" : pending ? "Updating…" : "Acknowledge"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
