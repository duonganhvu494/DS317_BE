import express from "express";
import { getWeeksByCourse } from "../controllers/courseWeek.controller.js";

const router = express.Router();
router.get("/:courseId/weeks", getWeeksByCourse);

export default router;
