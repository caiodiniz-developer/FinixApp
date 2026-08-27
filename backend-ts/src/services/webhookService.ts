import crypto from "crypto";
import { prisma } from "../lib/prisma";

export type WebhookEvent =
  | "transaction.created"
  | "transaction.deleted"
  | "goal.created"
  | "goal.completed"
  | "installment.created"
  | "alert.due_soon"
  | "alert.anomaly_detected";

const sign = (secret: string, body: string) =>
  crypto.createHmac("sha256", secret).update(body).digest("hex");

/**
 * Fire-and-forget delivery: finds the user's active subscriptions for this
 * event and POSTs the payload, signed the same way Stripe/GitHub sign
 * webhooks (HMAC-SHA256 over the raw JSON body, in a header the receiver
 * recomputes to verify authenticity). Failures are logged, never thrown —
 * a webhook delivery problem must never break the request that triggered it.
 */
export const dispatchWebhook = async (
  userId: string,
  event: WebhookEvent,
  payload: Record<string, any>,
): Promise<void> => {
  try {
    const subs = await prisma.webhookSubscription.findMany({
      where: { userId, active: true },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.all(
      subs
        .filter((s) => {
          try {
            const events: string[] = JSON.parse(s.events);
            return events.includes(event);
          } catch {
            return false;
          }
        })
        .map(async (sub) => {
          try {
            const signature = sign(sub.secret, body);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            await fetch(sub.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Finix-Signature": signature,
                "X-Finix-Event": event,
              },
              body,
              signal: controller.signal,
            });
            clearTimeout(timeout);
          } catch (err: any) {
            console.warn(`[WEBHOOK] Falha ao entregar para ${sub.url}:`, err.message);
          }
        }),
    );
  } catch (err: any) {
    console.error("[WEBHOOK] dispatchWebhook error:", err.message);
  }
};

export const generateWebhookSecret = () => crypto.randomBytes(32).toString("hex");
