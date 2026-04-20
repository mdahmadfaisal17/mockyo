import { Router } from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

function getClient() {
  const privateKey = (process.env.GA4_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });
}

const propertyId = process.env.GA4_PROPERTY_ID;

// GET /api/analytics/overview
// Returns: active users, sessions, pageviews, top pages, daily visitors (last 30 days)
router.get(
  "/overview",
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const client = getClient();

    const [summaryResponse, dailyResponse, topPagesResponse] = await Promise.all([
      // Total metrics last 30 days
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      }),
      // Daily visitors last 30 days
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "29daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      // Top 5 pages
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
    ]);

    const summaryRow = summaryResponse[0]?.rows?.[0];
    const summary = {
      activeUsers: parseInt(summaryRow?.metricValues?.[0]?.value || "0"),
      sessions: parseInt(summaryRow?.metricValues?.[1]?.value || "0"),
      pageViews: parseInt(summaryRow?.metricValues?.[2]?.value || "0"),
      bounceRate: parseFloat(summaryRow?.metricValues?.[3]?.value || "0"),
      avgSessionDuration: parseFloat(summaryRow?.metricValues?.[4]?.value || "0"),
    };

    const dailyVisitors = (dailyResponse[0]?.rows || []).map((row) => ({
      date: row.dimensionValues?.[0]?.value,
      users: parseInt(row.metricValues?.[0]?.value || "0"),
    }));

    const topPages = (topPagesResponse[0]?.rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value,
      views: parseInt(row.metricValues?.[0]?.value || "0"),
    }));

    res.json({ ok: true, summary, dailyVisitors, topPages });
  }),
);

export default router;
