export const transitions: Record<string, readonly string[]> = {
  BOOKED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["WAITING", "ASSIGNED", "WASHING", "CANCELLED"],
  WAITING: ["ASSIGNED", "WASHING", "CANCELLED"],
  ASSIGNED: ["WASHING", "CANCELLED"],
  WASHING: ["PAUSED", "INSPECTION", "COMPLETED", "CANCELLED"],
  PAUSED: ["WASHING", "COMPLETED", "CANCELLED"],
  INSPECTION: ["WASHING", "COMPLETED"],
  COMPLETED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
export function validTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
export function times(
  history: readonly { toStatus: string; createdAt: Date }[],
  now = new Date(),
) {
  const totals: Record<string, number> = {};
  for (let i = 0; i < history.length; i++) {
    const current = history[i];
    if (["BOOKED", "DELIVERED", "CANCELLED"].includes(current.toStatus))
      continue;
    const end = history[i + 1]?.createdAt ?? now;
    totals[current.toStatus] =
      (totals[current.toStatus] ?? 0) +
      Math.max(0, end.getTime() - current.createdAt.getTime());
  }
  return {
    waitMs: (totals.CHECKED_IN ?? 0) + (totals.WAITING ?? 0),
    washMs: totals.WASHING ?? 0,
    pauseMs: totals.PAUSED ?? 0,
    inspectionMs: totals.INSPECTION ?? 0,
    bayMs:
      (totals.ASSIGNED ?? 0) +
      (totals.WASHING ?? 0) +
      (totals.PAUSED ?? 0) +
      (totals.INSPECTION ?? 0),
    totalMs: Object.values(totals).reduce((sum, n) => sum + n, 0),
  };
}
