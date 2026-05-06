import type { Assignment } from "./store.js";
import type { AnalyticsOrder } from "./soppiyaGraph.js";

export type SalesAnalytics = {
  trackedOrders: number;
  grossSales: number;
  soldQuantity: number;
  assignmentSales: Record<
    string,
    {
      trackedOrders: number;
      grossSales: number;
      soldQuantity: number;
    }
  >;
};

const sellableOrderStatuses = new Set(["pending", "confirmed", "completed"]);

function assignmentMatchesLineItem(
  assignment: Assignment,
  lineItem: AnalyticsOrder["line_items"][number],
) {
  const productId = lineItem.variant?.product?._id;
  const variantId = lineItem.variant?._id;

  if (assignment.variantId) {
    return variantId === assignment.variantId;
  }

  return productId === assignment.productId;
}

export function calculateSalesAnalytics(
  assignments: Assignment[],
  orders: AnalyticsOrder[],
): SalesAnalytics {
  const matchedOrderIds = new Set<string>();
  const assignmentOrderIds = new Map<string, Set<string>>();
  const assignmentSales = new Map<
    string,
    {
      grossSales: number;
      soldQuantity: number;
    }
  >();
  let grossSales = 0;
  let soldQuantity = 0;

  for (const order of orders) {
    if (!sellableOrderStatuses.has(order.status)) {
      continue;
    }

    for (const lineItem of order.line_items) {
      const matchedAssignments = assignments.filter(
        (assignment) => assignmentMatchesLineItem(assignment, lineItem),
      );

      if (!matchedAssignments.length) {
        continue;
      }

      matchedOrderIds.add(order._id);
      grossSales += Number(lineItem.line_total ?? 0);
      soldQuantity += Number(lineItem.quantity ?? 0);

      for (const assignment of matchedAssignments) {
        const existingSales = assignmentSales.get(assignment.id) ?? {
          grossSales: 0,
          soldQuantity: 0,
        };
        const existingOrderIds =
          assignmentOrderIds.get(assignment.id) ?? new Set<string>();

        existingSales.grossSales += Number(lineItem.line_total ?? 0);
        existingSales.soldQuantity += Number(lineItem.quantity ?? 0);
        existingOrderIds.add(order._id);

        assignmentSales.set(assignment.id, existingSales);
        assignmentOrderIds.set(assignment.id, existingOrderIds);
      }
    }
  }

  return {
    trackedOrders: matchedOrderIds.size,
    grossSales,
    soldQuantity,
    assignmentSales: Object.fromEntries(
      Array.from(assignmentSales.entries()).map(([assignmentId, sales]) => [
        assignmentId,
        {
          trackedOrders: assignmentOrderIds.get(assignmentId)?.size ?? 0,
          ...sales,
        },
      ]),
    ),
  };
}
