import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  createInvestorSession,
  getInvestorSession,
  requireInvestorSession,
  requireMerchantAccess,
} from "./auth.js";
import { calculateSalesAnalytics } from "./analytics.js";
import { config } from "./config.js";
import {
  getStoreOrders,
  getStoreProducts,
  SoppiyaGraphError,
} from "./soppiyaGraph.js";
import {
  authenticateInvestor,
  createAssignment,
  createInvestor,
  deleteAssignment,
  deleteAssignmentByIdentity,
  deleteInvestor,
  listInvestors,
  listAssignments,
} from "./store.js";

const app = express();

function withAssignmentSales(
  assignments: Awaited<ReturnType<typeof listAssignments>>,
  analytics: ReturnType<typeof calculateSalesAnalytics>,
) {
  return assignments.map((assignment) => ({
    ...assignment,
    sales: analytics.assignmentSales[assignment.id] ?? {
      trackedOrders: 0,
      grossSales: 0,
      soldQuantity: 0,
    },
  }));
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.length === 0) {
        callback(null, true);
        return;
      }

      callback(null, config.corsOrigins.includes(origin));
    },
  }),
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "soppiya-investor-api",
    soppiyaGraphConfigured: Boolean(config.soppiyaStoreToken),
  });
});

app.get("/api/app/config", (_request, response) => {
  response.json({
    appName: config.appName,
    appBaseDomain: config.appBaseDomain,
    storeDomain: config.soppiyaStoreDomain,
    investorPortalUrl:
      config.soppiyaStoreDomain && config.appBaseDomain
        ? `https://investor.${config.soppiyaStoreDomain}`
        : "",
  });
});

app.get("/api/merchant/overview", requireMerchantAccess, async (_request, response, next) => {
  try {
    const assignments = await listAssignments();
    const orderData = await getStoreOrders(100);
    const analytics = calculateSalesAnalytics(
      assignments,
      orderData.orders.edges.map((edge) => edge.node),
    );

    response.json({
      assignedProducts: new Set(assignments.map((item) => item.productId)).size,
      activeInvestors: new Set(assignments.map((item) => item.investorEmail)).size,
      trackedOrders: analytics.trackedOrders,
      grossSales: analytics.grossSales,
      soldQuantity: analytics.soldQuantity,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/soppiya/products", requireMerchantAccess, async (request, response, next) => {
  try {
    const first = z.coerce.number().int().min(1).max(250).parse(request.query.first ?? 20);
    const result = await getStoreProducts(first);

    response.json(result.products);
  } catch (error) {
    next(error);
  }
});

app.get("/api/assignments", requireMerchantAccess, async (_request, response, next) => {
  try {
    const assignments = await listAssignments();
    const orderData = await getStoreOrders(100);
    const analytics = calculateSalesAnalytics(
      assignments,
      orderData.orders.edges.map((edge) => edge.node),
    );

    response.json({ assignments: withAssignmentSales(assignments, analytics) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/investors", requireMerchantAccess, async (_request, response, next) => {
  try {
    response.json({ investors: await listInvestors() });
  } catch (error) {
    next(error);
  }
});

const investorInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

app.post("/api/investors", requireMerchantAccess, async (request, response, next) => {
  try {
    const input = investorInput.parse(request.body);
    const investor = await createInvestor(input);

    response.status(201).json({ investor });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/investors/:email", requireMerchantAccess, async (request, response, next) => {
  try {
    const email = z
      .string()
      .email()
      .parse(decodeURIComponent(String(request.params.email)));
    const result = await deleteInvestor(email);

    if (!result.deleted) {
      response.status(404).json({ error: "Investor not found" });
      return;
    }

    response.json(result);
  } catch (error) {
    next(error);
  }
});

const investorLoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post("/api/investor/login", async (request, response, next) => {
  try {
    const input = investorLoginInput.parse(request.body);
    const investor = await authenticateInvestor(input.email, input.password);

    if (!investor) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const assignments = (await listAssignments()).filter(
      (assignment) =>
        assignment.investorEmail.toLowerCase() === investor.email.toLowerCase(),
    );
    const orderData = await getStoreOrders(100);
    const analytics = calculateSalesAnalytics(
      assignments,
      orderData.orders.edges.map((edge) => edge.node),
    );

    response.json({
      session: createInvestorSession({
        email: investor.email,
        name: investor.name,
      }),
      investor,
      metrics: {
        assignedProducts: new Set(assignments.map((item) => item.productId)).size,
        totalOrders: analytics.trackedOrders,
        totalSoldQuantity: analytics.soldQuantity,
        totalSales: analytics.grossSales,
        stockLeft: null,
      },
      assignments: withAssignmentSales(assignments, analytics),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/investor/dashboard", requireInvestorSession, async (_request, response, next) => {
  try {
    const session = getInvestorSession(response);
    const email = session.email;
    const assignments = (await listAssignments()).filter(
      (assignment) =>
        assignment.investorEmail.toLowerCase() === email.toLowerCase(),
    );
    const orderData = await getStoreOrders(100);
    const analytics = calculateSalesAnalytics(
      assignments,
      orderData.orders.edges.map((edge) => edge.node),
    );

    response.json({
      investor: {
        email,
        name: assignments[0]?.investorName ?? session.name,
      },
      metrics: {
        assignedProducts: new Set(assignments.map((item) => item.productId)).size,
        totalOrders: analytics.trackedOrders,
        totalSoldQuantity: analytics.soldQuantity,
        totalSales: analytics.grossSales,
        stockLeft: null,
      },
      assignments: withAssignmentSales(assignments, analytics),
    });
  } catch (error) {
    next(error);
  }
});

const assignmentInput = z.object({
  investorEmail: z.string().email(),
  investorName: z.string().min(1),
  productId: z.string().min(1),
  productTitle: z.string().min(1),
  variantId: z.string().min(1).optional(),
  variantTitle: z.string().min(1).optional(),
});

app.post("/api/assignments", requireMerchantAccess, async (request, response, next) => {
  try {
    const input = assignmentInput.parse(request.body);
    const assignment = await createAssignment(input);

    response.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/assignments/:id", requireMerchantAccess, async (request, response, next) => {
  try {
    let deleted = await deleteAssignment(String(request.params.id));

    if (!deleted) {
      const fallbackInput = z
        .object({
          investorEmail: z.string().email(),
          productId: z.string().min(1),
          variantId: z.string().min(1).optional(),
        })
        .safeParse(request.body);

      if (fallbackInput.success) {
        deleted = await deleteAssignmentByIdentity(fallbackInput.data);
      }
    }

    response.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: "Invalid request", details: error.issues });
      return;
    }

    if (error instanceof SoppiyaGraphError) {
      response.status(502).json({ error: "Soppiya Graph error", details: error.errors });
      return;
    }

    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  },
);

app.listen(config.port, () => {
  console.log(`Soppiya investor API listening on http://127.0.0.1:${config.port}`);
});
