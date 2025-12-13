import Course from "../models/Course.js";

export const getCourses = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);

  const data = await Course.find()
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Course.countDocuments();

  res.json({ page, limit, total, data });
};

export const getCourseById = async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  res.json(course);
};

