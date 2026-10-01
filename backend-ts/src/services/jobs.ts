import { runDueRecurringTransactions } from "./recurringService";
import { sendDueAlertNotifications } from "./alertNotificationService";
import { sendDueImpulseReflections } from "./impulseReflectionService";

export interface JobsResult {
  recurringCreated: number;
  alertsNotified: number;
  impulseNotified: number;
}

let running: Promise<JobsResult> | null = null;

/**
 * The daily housekeeping: materialise due recurring transactions, send
 * due-date reminders, send impulse-purchase nudges. Every job is idempotent
 * (each records what it already handled), so running this more than once a
 * day — boot, the in-process timer, the external cron — is harmless.
 * Overlapping calls share one run.
 */
export const runScheduledJobs = (): Promise<JobsResult> => {
  if (!running) {
    running = (async () => {
      const recurring = await runDueRecurringTransactions();
      const alerts = await sendDueAlertNotifications();
      const impulse = await sendDueImpulseReflections();
      return {
        recurringCreated: recurring.created,
        alertsNotified: alerts.notified,
        impulseNotified: impulse.notified,
      };
    })().finally(() => {
      running = null;
    });
  }
  return running;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * In-process fallback scheduler: once at boot (catches up on anything missed
 * while the server was down or asleep) and then every 24h. On hosts that put
 * idle instances to sleep this timer simply doesn't fire — the reliable
 * trigger is the external cron hitting POST /api/cron/run-jobs (see
 * routes/cronRoutes.ts and .github/workflows/daily-jobs.yml).
 */
export const startBackgroundJobs = () => {
  const run = () =>
    runScheduledJobs()
      .then((r) =>
        console.log(
          `[JOBS] Recorrências criadas: ${r.recurringCreated} · Alertas notificados: ${r.alertsNotified} · Reflexões de compra: ${r.impulseNotified}`,
        ),
      )
      .catch((err: any) => console.error("[JOBS] Falha ao rodar jobs agendados:", err.message));
  run();
  setInterval(run, DAY_MS).unref();
};
