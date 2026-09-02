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
  content: HumanReviewReportContent;
};

export function customerReportStatus(order: Pick<CustomerReportOrderShape, "status" | "status_enum">) {
  const status = (order.status_enum || order.status || "pending").toLowerCase();
  return status === "fulfilling" ? "processing" : status === "complete" ? "ready" : status;
}

export function partitionCustomerReportOrders<T extends CustomerReportOrderShape>(orders: readonly T[]) {
  const inProgress: T[] = [];
  const structuredFinished: StructuredFinishedCustomerReport<T>[] = [];
  const legacyFinished: T[] = [];

  for (const order of orders) {
    if (customerReportStatus(order) !== "ready") {
      inProgress.push(order);
      continue;
    }

    const content = parseHumanReviewReportContent(order.review_content);
    if (content) {
      structuredFinished.push({ order, content });
    } else {
      legacyFinished.push(order);
    }
  }

  return { inProgress, structuredFinished, legacyFinished };
}
