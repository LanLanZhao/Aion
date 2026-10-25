export type ReplyTiming = {
  startedAt: number;
  firstTokenAt?: number;
  completedAt?: number;
  kind: "simulated" | "thinking" | "response";
};

/** Only reasoning time stops at first visible text; ordinary generation runs to completion. */
export function replyDuration(timing: ReplyTiming, now = Date.now()): number {
  const end = timing.kind === "thinking" && timing.firstTokenAt != null
    ? timing.firstTokenAt : timing.completedAt ?? now;
  return Math.max(0, Math.round((end - timing.startedAt) / 100) / 10);
}
