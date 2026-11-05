import type { ChannelDeliveryResult, ChannelDispatchInput, NotificationChannelAdapter } from "../types";

interface WhatsAppConfig {
  token?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  timeoutMs?: number;
}

interface ProviderResponse {
  messages?: Array<{ id?: string }>;
  error?: { code?: string | number; message?: string };
}

function failed(errorCode: string, errorMessage: string): ChannelDeliveryResult {
  return { channel: "whatsapp", state: "failed", errorCode, errorMessage };
}

export function normalizeWhatsAppRecipient(value: string): string | null {
  const normalized = value.replace(/\D/g, "");
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : null;
}

export class WhatsAppNotificationChannel implements NotificationChannelAdapter {
  readonly channel = "whatsapp" as const;
  private readonly config: Required<Pick<WhatsAppConfig, "graphApiVersion" | "timeoutMs">> & WhatsAppConfig;

  constructor(config: WhatsAppConfig = {}) {
    this.config = {
      token: config.token ?? process.env.WHATSAPP_TOKEN,
      phoneNumberId: config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID,
      graphApiVersion: config.graphApiVersion ?? process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0",
      timeoutMs: config.timeoutMs ?? 10_000,
    };
  }

  async send(input: ChannelDispatchInput): Promise<ChannelDeliveryResult> {
    if (!this.config.token) return failed("missing_token", "WhatsApp credentials are not configured");
    if (!this.config.phoneNumberId) return failed("missing_phone_number_id", "WhatsApp phone number ID is not configured");
    const recipient = input.recipient ? normalizeWhatsAppRecipient(input.recipient) : null;
    if (!recipient) return failed("missing_recipient", "No valid WhatsApp recipient is configured for this facility");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        `https://graph.facebook.com/${encodeURIComponent(this.config.graphApiVersion)}/${encodeURIComponent(this.config.phoneNumberId)}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "text",
            text: { preview_url: false, body: input.report },
          }),
          signal: controller.signal,
        },
      );
      const body = (await response.json().catch(() => ({}))) as ProviderResponse;
      if (!response.ok) {
        const providerMessage = typeof body.error?.message === "string" ? body.error.message.trim() : "";
        return failed(
          body.error?.code ? `provider_${body.error.code}` : `provider_http_${response.status}`,
          providerMessage
            ? `WhatsApp provider rejected the message: ${providerMessage} (HTTP ${response.status})`
            : `WhatsApp provider rejected the message (HTTP ${response.status})`,
        );
      }
      const providerMessageId = body.messages?.[0]?.id;
      return { channel: this.channel, state: "delivered", ...(providerMessageId ? { providerMessageId } : {}) };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return failed(timedOut ? "timeout" : "network_error", timedOut ? "WhatsApp request timed out" : "WhatsApp delivery could not be completed");
    } finally {
      clearTimeout(timeout);
    }
  }
}
