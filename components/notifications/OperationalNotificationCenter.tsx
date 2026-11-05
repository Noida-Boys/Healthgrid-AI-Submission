"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Facility } from "@/lib/engine/types";
import type { TransferRecommendation } from "@/hooks/useRecommendations";
import { HAS_FIREBASE } from "@/hooks/useFacilities";
import { generateOperationalReport } from "@/lib/notifications/report";
import type { NotificationChannel, OperationalNotification } from "@/lib/notifications/types";

interface NotifyResponse {
  success: boolean;
  notificationId?: string;
  status?: OperationalNotification["status"];
  channels?: OperationalNotification["channelStatus"];
  error?: string;
}

export default function OperationalNotificationCenter({
  facility,
  facilities,
  recommendations,
}: {
  facility: Facility;
  facilities: Facility[];
  recommendations: TransferRecommendation[];
}) {
  const generatedReport = useMemo(
    () =>
      generateOperationalReport({
        facility,
        recommendations: recommendations.map((recommendation) => ({
          ...recommendation,
          fromFacilityName: facilities.find((item) => item.id === recommendation.fromFacilityId)?.name,
        })),
      }),
    [facilities, facility, recommendations],
  );
  const [report, setReport] = useState(generatedReport);
  const [channels, setChannels] = useState<Record<NotificationChannel, boolean>>({ in_app: true, whatsapp: false, sms: false });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "partial" | "error"; message: string } | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [notification, setNotification] = useState<OperationalNotification | null>(null);
  const [listenerError, setListenerError] = useState("");
  const previousFacilityId = useRef<string | null>(null);

  useEffect(() => {
    if (previousFacilityId.current !== facility.id) {
      previousFacilityId.current = facility.id;
      setReport(generatedReport);
      setNotificationId(null);
      setNotification(null);
      setFeedback(null);
      setListenerError("");
    }
  }, [facility.id, generatedReport]);

  useEffect(() => {
    if (!notificationId || !HAS_FIREBASE) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ clientDb }, { doc, onSnapshot }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;
      unsubscribe = onSnapshot(
        doc(clientDb, "notifications", notificationId),
        (snapshot) => {
          setListenerError("");
          setNotification(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as OperationalNotification) : null);
        },
        () => setListenerError("Live status is temporarily unavailable. Delivery results remain saved."),
      );
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [notificationId]);

  function toggleChannel(channel: "in_app" | "whatsapp") {
    setChannels((current) => ({ ...current, [channel]: !current[channel] }));
  }

  async function sendNotification() {
    if (sending) return;
    const selectedChannels = (["in_app", "whatsapp"] as const).filter((channel) => channels[channel]);
    if (!report.trim() || selectedChannels.length === 0) {
      setFeedback({ kind: "error", message: "Enter a report and select at least one available channel." });
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/actions/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId: facility.id, report, channels: selectedChannels }),
      });
      const body = (await response.json()) as NotifyResponse;
      if (!response.ok || !body.notificationId) throw new Error(body.error ?? "Notification could not be sent");
      setNotificationId(body.notificationId);
      setNotification({
        id: body.notificationId,
        facilityId: facility.id,
        facilityName: facility.name,
        title: `HealthGrid operational alert — ${facility.name}`,
        report,
        priority: facility.status === "critical" ? "critical" : facility.status === "at_risk" ? "high" : "low",
        channels: selectedChannels,
        channelStatus: body.channels ?? {},
        status: body.status ?? "created",
        read: false,
        acknowledged: false,
        createdAt: null,
        createdBy: "district-admin-demo",
        updatedAt: null,
      });
      const partial =
        body.status === "partially_delivered" ||
        body.status === "failed";

      const whatsappChannel = body.channels?.whatsapp;
      const whatsappFailure = whatsappChannel?.state === "failed";

      setFeedback({
        kind: partial ? "partial" : "success",
        message: partial
          ? whatsappFailure
            ? `WhatsApp delivery failed: ${
                whatsappChannel?.errorMessage ??
                "Unknown WhatsApp delivery error"
              }`
            : channels.in_app
              ? "In-app delivery was saved, but one selected channel needs attention."
              : "The notification was saved, but the selected delivery channel failed."
          : "Notification sent successfully.",
      });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Notification could not be sent" });
    } finally {
      setSending(false);
    }
  }

  const displayed = notification;
  return (
    <section className="rounded border border-line bg-surface-1 p-3" aria-labelledby="notification-center-title">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="notification-center-title" className="text-ink-1 text-sm font-semibold">Operational Notification Center</h2>
          <p className="text-ink-3 text-[11px] mt-0.5">Send an auditable operational report to this facility.</p>
        </div>
        <button type="button" onClick={() => setReport(generatedReport)} className="text-xs text-accent hover:underline">
          Reset report
        </button>
      </div>

      <label htmlFor="operational-report" className="rail-label block mb-1.5">Generated operational report</label>
      <textarea
        id="operational-report"
        value={report}
        onChange={(event) => setReport(event.target.value)}
        maxLength={4000}
        rows={13}
        className="w-full resize-y rounded border border-line bg-surface-0 p-2.5 text-xs leading-5 text-ink-1 focus:border-accent focus:outline-none"
      />
      <div className="text-right text-[10px] text-ink-3 mt-1">{report.length}/4000</div>

      <fieldset className="mt-3 space-y-2">
        <legend className="rail-label mb-2">Delivery channels</legend>
        <ChannelOption label="In-App Notification" checked={channels.in_app} onChange={() => toggleChannel("in_app")} />
        <ChannelOption label="WhatsApp" checked={channels.whatsapp} onChange={() => toggleChannel("whatsapp")} />
        <ChannelOption label="SMS" checked={false} disabled detail="Coming soon" onChange={() => undefined} />
      </fieldset>

      <button
        type="button"
        onClick={sendNotification}
        disabled={sending || !report.trim() || (!channels.in_app && !channels.whatsapp)}
        className="mt-3 w-full rounded bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send Notification"}
      </button>

      {feedback && (
        <div
          role="status"
          className={`mt-3 rounded border px-2.5 py-2 text-xs ${
            feedback.kind === "error"
              ? "border-critical/50 bg-critical-dim text-critical"
              : feedback.kind === "partial"
                ? "border-at-risk/50 bg-at-risk-dim text-at-risk"
                : "border-healthy/50 bg-healthy-dim text-healthy"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {displayed && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="rail-label mb-2">Latest notification status</div>
          <div className="grid grid-cols-2 gap-2">
            <StatusItem label="In-App" value={displayed.channelStatus.in_app?.state ?? "Not selected"} />
            <StatusItem label="WhatsApp" value={displayed.channelStatus.whatsapp?.state ?? "Not selected"} />
            <StatusItem label="Read" value={displayed.read ? "Read" : "Awaiting read"} positive={displayed.read} />
            <StatusItem label="Acknowledged" value={displayed.acknowledged ? "Acknowledged" : "Awaiting acknowledgement"} positive={displayed.acknowledged} />
          </div>
        </div>
      )}
      {listenerError && <p className="mt-2 text-[11px] text-at-risk" role="status">{listenerError}</p>}
    </section>
  );
}

function ChannelOption({
  label,
  checked,
  onChange,
  disabled = false,
  detail,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  detail?: string;
}) {
  return (
    <label className={`flex items-center justify-between rounded border border-line px-2.5 py-2 text-xs ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="flex items-center gap-2 text-ink-2">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="accent-[var(--accent)]" />
        {label}
      </span>
      {detail && <span className="text-[10px] text-ink-3">{detail}</span>}
    </label>
  );
}

function StatusItem({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const delivered = positive ?? value === "delivered";
  const failed = value === "failed" || value === "skipped";
  return (
    <div className="rounded border border-line bg-surface-2 p-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`mt-0.5 text-xs font-medium ${failed ? "text-critical" : delivered ? "text-healthy" : "text-ink-2"}`}>
        {delivered ? "✓ " : failed ? "! " : ""}{value.replaceAll("_", " ")}
      </div>
    </div>
  );
}
