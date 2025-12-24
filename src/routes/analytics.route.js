import express from "express";
import {
  getSystemTrend,
  getSystemTrendByFilter,
  getPlatformStudentProgress,
  getSystemStudentProgressByFilter,
  getSystemEngagementQuality,
  getSystemEngagementQualityByFilter,
  getOverallQuality,
  getFinalRankDistribution,
  getCourseMetricsByCourseId
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/system/trend", getSystemTrend);
router.get("/system/trend/filter", getSystemTrendByFilter);
router.get("/system/student-progress", getPlatformStudentProgress);
router.get("/system/student-progress/filter", getSystemStudentProgressByFilter);

router.get("/system/engagement-quality", getSystemEngagementQuality);

router.get(
  "/system/engagement-quality/filter",
  getSystemEngagementQualityByFilter
);

router.get("/system/overall-quality", getOverallQuality);

router.get("/system/final-rank-distribution", getFinalRankDistribution);

router.get(
  "/course/:courseId/metrics",
  getCourseMetricsByCourseId
);
export default router;
