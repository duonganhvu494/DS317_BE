import CourseWeekStats from "../models/CourseWeekStats.js";

export const getWeeksByCourse = async (req, res) => {
  const { courseId } = req.params;
  const from = Number(req.query.from || 1);
  const to = Number(req.query.to || 100);

  const data = await CourseWeekStats.find({
    course_id: courseId,
    week: { $gte: from, $lte: to }
  }).sort({ week: 1 });

  res.json(data);
};
