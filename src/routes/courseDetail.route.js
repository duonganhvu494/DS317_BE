import express from "express";
import { getCourseProgress, getCourseTrend, getCourseEngagementQuality} from "../controllers/courseDetail.controller.js";

const router = express.Router();

router.get("/:id/detail/progress", getCourseProgress);
router.get(
  "/:courseId/trend",
  getCourseTrend
);
router.get(
  "/:courseId/engagement-quality",
  getCourseEngagementQuality
);


export default router;
