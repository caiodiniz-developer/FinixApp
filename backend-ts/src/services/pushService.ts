import webpush from "web-push";
import { prisma } from "../lib/prisma";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:suporte@finixapp.com.br";

export const isPushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isPushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
} else {
  console.warn(
    "[PUSH] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não definidos — notificações push desativadas. " +
      "Gere um par com `npx web-push generate-vapid-keys` (não precisa de conta em serviço nenhum).",
  );
}

export const getVapidPublicKey = () => VAPID_PUBLIC_KEY || null;

export const sendPushToUser = async (
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> => {
  if (!isPushConfigured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        // 410 Gone / 404 = the browser subscription expired — clean it up so
        // we stop wasting a call on it every time.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.warn("[PUSH] Falha ao enviar notificação:", err.message);
        }
      }
    }),
  );
};
