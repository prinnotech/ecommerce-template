import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { getAnalytics } from "@repo/core/actions/analytics";
import { getCustomer, getCustomers } from "@repo/core/actions/customers";
import { getDiscount, getDiscounts } from "@repo/core/actions/discounts";
import { getDraftOrder, getDraftOrders } from "@repo/core/actions/draft-orders";
import { adjustStock, getInventory } from "@repo/core/actions/inventory";
import {
  addOrderNote,
  getAdminOrder,
  getAdminOrders,
  updateOrderStatus,
  updateTracking,
} from "@repo/core/actions/orders";
import { getAdminProduct, getAdminProducts } from "@repo/core/actions/products";
import type { ActionResult } from "@repo/core/lib/action-result";
import { ANALYTICS_RANGES } from "@repo/core/lib/analytics";
import { resolveApiKey, runAsApiUser } from "@repo/core/lib/api-keys";
import { getDictionary } from "@repo/core/lib/i18n";
import { ORDER_STATUSES } from "@repo/core/lib/orders";
import { getClientIp, isOverLimit, isRateLimited } from "@repo/core/lib/rate-limit";
import { PRODUCT_STATUSES } from "@repo/core/lib/schemas/catalog";
import { DISCOUNT_STATUSES } from "@repo/core/lib/schemas/discounts";
import { DRAFT_STATUSES } from "@repo/core/lib/schemas/draft-orders";
import { ADJUSTMENT_REASONS, STOCK_FILTERS } from "@repo/core/lib/schemas/inventory";

// The store's MCP server (Streamable HTTP, stateless). Every tool calls the same server action the
// admin screens use, inside runAsApiUser(), so the key's staff member, their roles, the read-only
// demo role and the activity log apply exactly as in the admin. Money is in cents.

const page = z.number().int().min(1).optional().describe("Page number, 1 = first page");
const search = z.string().max(100).optional().describe("Free-text search");
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Action results become tool results: the data as JSON, or the error code with its English text.
async function toToolResult<T>(result: ActionResult<T>): Promise<ToolResult> {
  if (result.ok) return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
  const errors = (await getDictionary("en")).errors;
  return { content: [{ type: "text", text: `${result.error}: ${errors[result.error]}` }], isError: true };
}

function createServer(): McpServer {
  const server = new McpServer({ name: "store", version: "1.0.0" });

  // ---------- Orders ----------
  server.registerTool(
    "list_orders",
    {
      description: "List orders, newest first, 25 per page. Totals are in cents.",
      inputSchema: {
        search: search.describe("Order number, customer name or email"),
        status: z.enum(["all", "open", "archived", ...ORDER_STATUSES]).optional(),
        payment: z.enum(["all", "unpaid", "paid", "refunded"]).optional(),
        page,
      },
      annotations: READ,
    },
    async (input) => toToolResult(await getAdminOrders(input)),
  );
  server.registerTool(
    "get_order",
    {
      description: "One order with its lines, addresses, payment, refunds and timeline.",
      inputSchema: { id: z.string().describe("Order id (from list_orders)") },
      annotations: READ,
    },
    async ({ id }) => toToolResult(await getAdminOrder(id)),
  );
  server.registerTool(
    "update_order_status",
    {
      description:
        "Move an order to processing, shipped, delivered or cancelled. Cancelling restocks unless is_restock is false.",
      inputSchema: {
        id: z.string(),
        status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
        is_restock: z.boolean().optional().describe("Only for cancelling; default true"),
      },
      annotations: WRITE,
    },
    async ({ id, status, is_restock }) =>
      toToolResult(await updateOrderStatus({ id, status, is_restock: is_restock ?? true })),
  );
  server.registerTool(
    "update_order_tracking",
    {
      description: "Set the carrier and tracking number of an order, optionally marking it shipped.",
      inputSchema: {
        id: z.string(),
        carrier: z.string().max(100),
        tracking_number: z.string().max(100),
        tracking_url: z.string().optional().describe("Full https URL, or empty"),
        is_mark_shipped: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    async (input) =>
      toToolResult(
        await updateTracking({
          ...input,
          tracking_url: input.tracking_url ?? "",
          is_mark_shipped: input.is_mark_shipped ?? false,
        }),
      ),
  );
  server.registerTool(
    "add_order_note",
    {
      description: "Add a note to an order's timeline. Customer-visible notes are shown on the customer's order page.",
      inputSchema: {
        id: z.string(),
        message: z.string().min(1).max(2000),
        is_customer_visible: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    async ({ id, message, is_customer_visible }) =>
      toToolResult(await addOrderNote({ id, message, is_customer_visible: is_customer_visible ?? false })),
  );

  // ---------- Products and stock ----------
  server.registerTool(
    "list_products",
    {
      description: "List products with price (cents), status and stock.",
      inputSchema: { search, status: z.enum(["all", ...PRODUCT_STATUSES]).optional(), page },
      annotations: READ,
    },
    async (input) => toToolResult(await getAdminProducts(input)),
  );
  server.registerTool(
    "get_product",
    {
      description: "One product with its variants (size, color, SKU, stock, price).",
      inputSchema: { id: z.string() },
      annotations: READ,
    },
    async ({ id }) => toToolResult(await getAdminProduct(id)),
  );
  server.registerTool(
    "list_inventory",
    {
      description: "Stock per variant. stock = all, low (at or under the low-stock threshold) or out.",
      inputSchema: { search, stock: z.enum(STOCK_FILTERS).optional(), page },
      annotations: READ,
    },
    async (input) => toToolResult(await getInventory(input)),
  );
  server.registerTool(
    "adjust_stock",
    {
      description:
        "Change a variant's stock: mode set = new quantity, add = change (negative removes). Logged in the stock history.",
      inputSchema: {
        variant_id: z.string(),
        mode: z.enum(["set", "add"]),
        quantity: z.number().int(),
        reason: z.enum(ADJUSTMENT_REASONS),
        note: z.string().max(500).optional(),
      },
      annotations: WRITE,
    },
    async (input) => toToolResult(await adjustStock({ ...input, note: input.note ?? "" })),
  );

  // ---------- Draft orders, customers, discounts, reports ----------
  server.registerTool(
    "list_draft_orders",
    {
      description: "List draft orders (orders staff create for customers).",
      inputSchema: { search, status: z.enum(["all", ...DRAFT_STATUSES]).optional(), page },
      annotations: READ,
    },
    async (input) => toToolResult(await getDraftOrders(input)),
  );
  server.registerTool(
    "get_draft_order",
    { description: "One draft order with its lines and totals.", inputSchema: { id: z.string() }, annotations: READ },
    async ({ id }) => toToolResult(await getDraftOrder(id)),
  );
  server.registerTool(
    "list_customers",
    {
      description: "List customers (accounts and guests) with order count and total spent (cents).",
      inputSchema: { search, type: z.enum(["all", "registered", "guest", "subscribed"]).optional(), page },
      annotations: READ,
    },
    async (input) => toToolResult(await getCustomers(input)),
  );
  server.registerTool(
    "get_customer",
    {
      description: "One customer with their orders and addresses.",
      inputSchema: { key: z.string().describe("Customer key from list_customers") },
      annotations: READ,
    },
    async ({ key }) => toToolResult(await getCustomer(key)),
  );
  server.registerTool(
    "list_discounts",
    {
      description: "List discount codes with their status and usage.",
      inputSchema: { search, status: z.enum(["all", ...DISCOUNT_STATUSES]).optional(), page },
      annotations: READ,
    },
    async (input) => toToolResult(await getDiscounts(input)),
  );
  server.registerTool(
    "get_discount",
    { description: "One discount code.", inputSchema: { id: z.string() }, annotations: READ },
    async ({ id }) => toToolResult(await getDiscount(id)),
  );
  server.registerTool(
    "get_sales_report",
    {
      description:
        "Sales, orders, average order value, top products and a sales chart for a period. Dates are YYYY-MM-DD in the store's time zone.",
      inputSchema: {
        range: z.enum(ANALYTICS_RANGES).optional(),
        from: z.string().optional().describe("With range custom"),
        to: z.string().optional().describe("With range custom"),
      },
      annotations: READ,
    },
    async (input) => toToolResult(await getAnalytics(input)),
  );

  return server;
}

function jsonError(status: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status });
}

// The admin's /api/mcp route: checks the Bearer API key, then serves the request as its staff member.
export async function handleMcpRequest(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const ip = await getClientIp();
  if (!key) return jsonError(401, "Missing API key (Authorization: Bearer <key>).");
  // At most 20 wrong keys per address per 10 minutes, so keys can't be guessed.
  if (isOverLimit(`mcp_bad:${ip}`, 20, 600_000) || isRateLimited(`mcp:${ip}`, 300, 60_000)) {
    return jsonError(429, "Too many requests.");
  }
  const user = await resolveApiKey(key);
  if (!user) {
    isRateLimited(`mcp_bad:${ip}`, 20, 600_000);
    return jsonError(401, "Invalid or revoked API key.");
  }

  return runAsApiUser(user, async () => {
    const server = createServer();
    // Stateless: a new server and transport per request, with plain JSON responses.
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  });
}
