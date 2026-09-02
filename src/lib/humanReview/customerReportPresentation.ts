import {
  parseHumanReviewReportContent,
  type HumanReviewReportContent,
} from "./reportContent";

export type CustomerReportOrderShape = {
  status: string | null;
  status_enum: string | null;
  review_content: unknown;
};

export type StructuredFinishedCustomerReport<T> = {
  order: T;
  kind: "structured";
  content: HumanReviewReportContent;
};

export type LegacyFinishedCustomerReport<T> = {
  order: T;
  kind: "legacy";
  content: null;
};

export type FinishedCustomerReport<T> =
  | StructuredFinishedCustomerReport<T>
  | LegacyFinishedCustomerReport<T>;

export function customerReportStatus(order: Pick<CustomerReportOrderShape, "status" | "status_enum">) {
  const status = (order.status_enum || order.status || "pending").toLowerCase();
  return status === "fulfilling" ? "processing" : status === "complete" ? "ready" : status;
}

export function partitionCustomerReportOrders<T extends CustomerReportOrderShape>(orders: readonly T[]) {
  const inProgress: T[] = [];
  const finished: FinishedCustomerReport<T>[] = [];
  const structuredFinished: StructuredFinishedCustomerReport<T>[] = [];
  const legacyFinished: T[] = [];

  for (const order of orders) {
    if (customerReportStatus(order) !== "ready") {
      inProgress.push(order);
      continue;
    }

    const content = parseHumanReviewReportContent(order.review_content);
    if (content) {
      const report: StructuredFinishedCustomerReport<T> = {
        order,
        kind: "structured",
        content,
      };
      finished.push(report);
      structuredFinished.push(report);
    } else {
      finished.push({ order, kind: "legacy", content: null });
      legacyFinished.push(order);
    }
  }

  return { inProgress, finished, structuredFinished, legacyFinished };
}
