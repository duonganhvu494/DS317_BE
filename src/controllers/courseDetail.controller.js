import CourseMetric from "../models/CourseMetric.js";

export async function getCourseProgress(req, res) {
  try {
    const { id } = req.params;

    // 1️⃣ Lấy metrics theo tuần
    const metrics = await CourseMetric.find(
      { course_id: id },
      {
        relative_week: 1,
        new_enrolls: 1,
        dropout_count: 1,
        completion_rate: 1
      }
    ).sort({ relative_week: 1 });

    // 2️⃣ Tính tiến trình
    let activeStudents = 0;

    const result = metrics.map(m => {
      const newEnrolls = Number(m.new_enrolls || 0);
      const dropouts = Number(m.dropout_count || 0);

      // cập nhật active students
      activeStudents = Math.max(
        activeStudents + newEnrolls - dropouts,
        0
      );

      const completionRate = Number(m.completion_rate || 0);
      const completedStudents = Math.round(
        activeStudents * completionRate
      );

      return {
        week: `W${m.relative_week}`,

        // flow
        new_enrolls: newEnrolls,
        dropout_count: dropouts,

        // state
        active_students: activeStudents,
        completed_students: completedStudents,

        completion_rate: completionRate
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Course progress error:", err);
    res.status(500).json({ message: "Failed to load course progress" });
  }
}

export async function getCourseTrend(req, res) {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({
        message: "courseId is required"
      });
    }

    /* ===============================
       1️⃣ FILTER
    =============================== */
    const match = {
      course_id: courseId
    };

    /* ===============================
       2️⃣ AGGREGATE
    =============================== */
    const data = await CourseMetric.aggregate([
      { $match: match },

      {
        $group: {
          _id: "$relative_week",

          // vì chỉ có 1 course → avg = giá trị tuần đó
          avg_completion_rate: { $avg: "$completion_rate" },
          avg_engagement: { $avg: "$exercise_engagement_week" },
          avg_assignment_score: { $avg: "$avg_assignment_score" }
        }
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          week: "$_id",
          avg_completion_rate: { $round: ["$avg_completion_rate", 4] },
          avg_engagement: { $round: ["$avg_engagement", 4] },
          avg_assignment_score: { $round: ["$avg_assignment_score", 4] }
        }
      }
    ]);

    res.json(data);
  } catch (err) {
    console.error("getCourseTrend error:", err);
    res.status(500).json({
      message: "Failed to load course trend"
    });
  }
}

export async function getCourseEngagementQuality(req, res) {
  try {
    const { courseId } = req.params;
    const { fromWeek, toWeek } = req.query;

    if (!courseId) {
      return res.status(400).json({
        message: "courseId is required"
      });
    }

    /* ===============================
       1️⃣ FILTER
    =============================== */
    const match = {
      course_id: courseId
    };

    if (fromWeek || toWeek) {
      match.relative_week = {};
      if (fromWeek) match.relative_week.$gte = Number(fromWeek);
      if (toWeek) match.relative_week.$lte = Number(toWeek);
    }

    /* ===============================
       2️⃣ AGGREGATE
    =============================== */
    const data = await CourseMetric.aggregate([
      { $match: match },

      {
        $group: {
          _id: "$relative_week",

          // chất lượng (avg)
          avg_sentiment: { $avg: "$avg_sentiment" },
          avg_assignment_score: { $avg: "$avg_assignment_score" },

          // hành vi (sum)
          weekly_submit_count: { $sum: "$weekly_submit_count" },
          comments_count: { $sum: "$comments_count" }
        }
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          week: { $concat: ["W", { $toString: "$_id" }] },

          avg_sentiment: { $round: ["$avg_sentiment", 4] },
          avg_assignment_score: { $round: ["$avg_assignment_score", 4] },

          weekly_submit_count: 1,
          comments_count: 1
        }
      }
    ]);

    res.json(data);
  } catch (err) {
    console.error("getCourseEngagementQuality error:", err);
    res.status(500).json({
      message: "Failed to load course engagement quality"
    });
  }
}
