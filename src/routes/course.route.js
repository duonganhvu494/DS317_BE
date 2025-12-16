import express from "express";
import {
  getAllCourses,
  getCourseById,
  filterCourses,
  getOverviewStats,
  getCourseDanger,
  getCourseFilters
} from "../controllers/course.controller.js";

const router = express.Router();

router.get("/", getAllCourses);
router.get("/danger", getCourseDanger);
router.get("/filter", filterCourses);
router.get("/courseFilters", getCourseFilters);
router.get("/stats/overview", getOverviewStats);
router.get("/:id", getCourseById);

export default router;
