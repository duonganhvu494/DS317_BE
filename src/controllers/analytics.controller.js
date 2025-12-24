import CourseMetric from "../models/CourseMetric.js";
import Course from "../models/Course.js";

export async function getSystemTrend(req, res) {
  try {
    const { fromWeek, toWeek } = req.query;

    const match = {};
    if (fromWeek || toWeek) {
      match.relative_week = {};
      if (fromWeek) match.relative_week.$gte = Number(fromWeek);
      if (toWeek) match.relative_week.$lte = Number(toWeek);
    }

    const data = await CourseMetric.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $group: {
          _id: "$relative_week",
          avg_completion_rate: { $avg: "$completion_rate" },
          avg_engagement: { $avg: "$exercise_engagement_week" },
          avg_assignment_score: { $avg: "$avg_assignment_score" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          week: "$_id",
          avg_completion_rate: { $round: ["$avg_completion_rate", 4] },
          avg_engagement: { $round: ["$avg_engagement", 4] },
          avg_assignment_score: { $round: ["$avg_assignment_score", 4] },
        },
      },
    ]);

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "System trend failed" });
  }
}

export async function getSystemTrendByFilter(req, res) {
  try {
    const { field, school, fromWeek, toWeek } = req.query;
    /* ===============================
       1️⃣ FILTER COURSE TRƯỚC
    =============================== */

    const courseQuery = {};

    // field_en là ARRAY
    if (field) {
      courseQuery.field_en = { $in: [field] };
    }

    // school cũng là ARRAY
    if (school) {
      courseQuery.school = { $in: [school] };
    }

    const courses = await Course.find(courseQuery, { _id: 1 }).lean();
    const courseIds = courses.map((c) => c._id);

    if (courseIds.length === 0) {
      return res.json([]);
    }

    /* ===============================
       2️⃣ AGGREGATE METRICS
    =============================== */

    const metricMatch = {
      course_id: { $in: courseIds },
    };

    if (fromWeek || toWeek) {
      metricMatch.relative_week = {};
      if (fromWeek) metricMatch.relative_week.$gte = Number(fromWeek);
      if (toWeek) metricMatch.relative_week.$lte = Number(toWeek);
    }

    const data = await CourseMetric.aggregate([
      { $match: metricMatch },

      {
        $group: {
          _id: "$relative_week",
          avg_completion_rate: { $avg: "$completion_rate" },
          avg_engagement: { $avg: "$exercise_engagement_week" },
          avg_assignment_score: { $avg: "$avg_assignment_score" },
          course_count: { $addToSet: "$course_id" },
        },
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          week: "$_id",
          avg_completion_rate: { $round: ["$avg_completion_rate", 4] },
          avg_engagement: { $round: ["$avg_engagement", 4] },
          avg_assignment_score: { $round: ["$avg_assignment_score", 4] },
          course_count: { $size: "$course_count" },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    console.error("SystemTrendByFilter error:", err);
    res.status(500).json({ message: "Failed to get filtered system trend" });
  }
} 

export async function getPlatformStudentProgress(req, res) {
  try {
    const { fromWeek, toWeek } = req.query;

    const match = {};
    if (fromWeek || toWeek) {
      match.relative_week = {};
      if (fromWeek) match.relative_week.$gte = Number(fromWeek);
      if (toWeek) match.relative_week.$lte = Number(toWeek);
    }

    const result = await CourseMetric.aggregate([
      { $match: match },

      // 1️⃣ Sort để window function đúng
      { $sort: { course_id: 1, relative_week: 1 } },

      // 2️⃣ Active THEO COURSE
      {
        $setWindowFields: {
          partitionBy: "$course_id",
          sortBy: { relative_week: 1 },
          output: {
            active_students_course: {
              $sum: {
                $subtract: ["$new_enrolls", "$dropout_count"]
              },
              window: {
                documents: ["unbounded", "current"]
              }
            }
          }
        }
      },

      // 3️⃣ Clamp active >= 0 (giống JS)
      {
        $addFields: {
          active_students_course: {
            $cond: [
              { $lt: ["$active_students_course", 0] },
              0,
              "$active_students_course"
            ]
          }
        }
      },

      // 4️⃣ TÍNH completed THEO COURSE (QUAN TRỌNG)
      {
        $addFields: {
          completed_students_course: {
            $round: [
              {
                $multiply: [
                  "$active_students_course",
                  { $ifNull: ["$completion_rate", 0] }
                ]
              },
              0
            ]
          }
        }
      },

      // 5️⃣ Aggregate lên SYSTEM theo tuần
      {
        $group: {
          _id: "$relative_week",
          new_enrolls: { $sum: "$new_enrolls" },
          dropout_count: { $sum: "$dropout_count" },
          active_students: { $sum: "$active_students_course" },
          completed_students: { $sum: "$completed_students_course" }
        }
      },

      { $sort: { _id: 1 } },

      // 6️⃣ Final format
      {
        $project: {
          _id: 0,
          week: { $concat: ["W", { $toString: "$_id" }] },
          new_enrolls: 1,
          dropout_count: 1,
          active_students: 1,
          completed_students: 1
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    console.error("Platform progress error:", err);
    res.status(500).json({ message: "Failed to load platform progress" });
  }
}

export async function getSystemStudentProgressByFilter(req, res) {
  try {
    const { field, school, fromWeek, toWeek } = req.query;

    /* ===============================
       1️⃣ MATCH METRIC (THEO TUẦN)
    =============================== */
    const matchMetric = {};
    if (fromWeek || toWeek) {
      matchMetric.relative_week = {};
      if (fromWeek) matchMetric.relative_week.$gte = Number(fromWeek);
      if (toWeek) matchMetric.relative_week.$lte = Number(toWeek);
    }

    /* ===============================
       2️⃣ MATCH COURSE (FIELD / SCHOOL)
    =============================== */
    const matchCourse = {};
    if (field) matchCourse["course.field_en"] = { $in: [field] };
    if (school) matchCourse["course.school"] = { $in: [school] };

    const result = await CourseMetric.aggregate([
      { $match: matchMetric },

      /* ===============================
         3️⃣ JOIN COURSE
      =============================== */
      {
        $lookup: {
          from: "courses",
          localField: "course_id",
          foreignField: "_id",
          as: "course"
        }
      },
      { $unwind: "$course" },

      { $match: matchCourse },

      /* ===============================
         4️⃣ SORT CHO WINDOW FUNCTION
      =============================== */
      { $sort: { course_id: 1, relative_week: 1 } },

      /* ===============================
         5️⃣ ACTIVE PER COURSE
      =============================== */
      {
        $setWindowFields: {
          partitionBy: "$course_id",
          sortBy: { relative_week: 1 },
          output: {
            active_students_course: {
              $sum: {
                $subtract: ["$new_enrolls", "$dropout_count"]
              },
              window: {
                documents: ["unbounded", "current"]
              }
            }
          }
        }
      },

      /* ===============================
         6️⃣ CLAMP ACTIVE >= 0
      =============================== */
      {
        $addFields: {
          active_students_course: {
            $cond: [
              { $lt: ["$active_students_course", 0] },
              0,
              "$active_students_course"
            ]
          }
        }
      },

      /* ===============================
         7️⃣ COMPLETED PER COURSE
      =============================== */
      {
        $addFields: {
          completed_students_course: {
            $round: [
              {
                $multiply: [
                  "$active_students_course",
                  { $ifNull: ["$completion_rate", 0] }
                ]
              },
              0
            ]
          }
        }
      },

      /* ===============================
         8️⃣ AGGREGATE TO SYSTEM (PER WEEK)
      =============================== */
      {
        $group: {
          _id: "$relative_week",
          new_enrolls: { $sum: "$new_enrolls" },
          dropout_count: { $sum: "$dropout_count" },
          active_students: { $sum: "$active_students_course" },
          completed_students: { $sum: "$completed_students_course" }
        }
      },

      { $sort: { _id: 1 } },

      /* ===============================
         9️⃣ FINAL FORMAT
      =============================== */
      {
        $project: {
          _id: 0,
          week: "$_id",
          new_enrolls: 1,
          dropout_count: 1,
          active_students: 1,
          completed_students: 1
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    console.error("getSystemStudentProgressByFilter error:", err);
    res
      .status(500)
      .json({ message: "Failed to load filtered student progress" });
  }
}

export async function getSystemEngagementQuality(req, res) {
  try {
    const { fromWeek, toWeek } = req.query;

    const match = {};
    if (fromWeek || toWeek) {
      match.relative_week = {};
      if (fromWeek) match.relative_week.$gte = Number(fromWeek);
      if (toWeek) match.relative_week.$lte = Number(toWeek);
    }

    const data = await CourseMetric.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),

      {
        $group: {
          _id: "$relative_week",

          avg_sentiment: { $avg: "$avg_sentiment" },
          avg_assignment_score: { $avg: "$avg_assignment_score" },

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
    console.error("getSystemEngagementQuality error:", err);
    res
      .status(500)
      .json({ message: "Failed to load system engagement quality" });
  }
}

export async function getSystemEngagementQualityByFilter(req, res) {
  try {
    const { field, school, fromWeek, toWeek } = req.query;

    /* ===============================
       1️⃣ FILTER COURSE
    =============================== */
    const courseQuery = {};

    // field_en là ARRAY → Mongo tự match contains
    if (field) {
      courseQuery.field_en = field;
    }

    // school cũng là ARRAY
    if (school) {
      courseQuery.school = school;
    }

    const courses = await Course.find(courseQuery, { _id: 1 }).lean();
    const courseIds = courses.map(c => String(c._id));

    if (!courseIds.length) {
      return res.json([]);
    }

    /* ===============================
       2️⃣ FILTER METRICS
    =============================== */
    const metricMatch = {
      course_id: { $in: courseIds }
    };

    if (fromWeek || toWeek) {
      metricMatch.relative_week = {};
      if (fromWeek) metricMatch.relative_week.$gte = Number(fromWeek);
      if (toWeek) metricMatch.relative_week.$lte = Number(toWeek);
    }

    /* ===============================
       3️⃣ AGGREGATE METRICS
    =============================== */
    const data = await CourseMetric.aggregate([
      { $match: metricMatch },

      {
        $group: {
          _id: "$relative_week",

          // chất lượng (avg)
          avg_sentiment: { $avg: "$avg_sentiment" },
          avg_assignment_score: { $avg: "$avg_assignment_score" },

          // hành vi (sum)
          weekly_submit_count: { $sum: "$weekly_submit_count" },
          comments_count: { $sum: "$comments_count" },

          // optional: số course góp dữ liệu
          course_count: { $addToSet: "$course_id" }
        }
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          week: { $concat: ["W", { $toString: "$_id" }] },

          avg_sentiment: { $round: ["$avg_sentiment", 4] },
          avg_assignment_score: {
            $round: ["$avg_assignment_score", 4]
          },

          weekly_submit_count: 1,
          comments_count: 1,

          course_count: { $size: "$course_count" }
        }
      }
    ]);

    res.json(data);
  } catch (err) {
    console.error(
      "getSystemEngagementQualityByFilter error:",
      err
    );
    res.status(500).json({
      message: "Failed to load filtered engagement quality"
    });
  }
}

export async function getOverallQuality(req, res) {
  try {
    const result = await Course.aggregate([
      {
        $group: {
          _id: null,

          avg_completion_rate: { $avg: "$completion_rate" },
          avg_sentiment_index: { $avg: "$sentiment_index" },
          avg_school_ranking: { $avg: "$school_ranking" },
          avg_teacher_rate: { $avg: "$teacher_rate" },
          avg_video_engagement: { $avg: "$video_engagement" },
          avg_exercise_engagement: { $avg: "$exercise_engagement" }
        }
      }
    ]);

    if (!result.length) return res.json([]);

    const r = result[0];

    // Helper: chuẩn hoá về thang 1–5 (sau đó convert % cho FE)
    const toScore = (value, max = 5) =>
      Math.round((value / max) * 100);

    const data = [
      {
        metric: "Completion Rate",
        value: toScore(r.avg_completion_rate)
      },
      {
        metric: "Learning Satisfaction",
        value: toScore(r.avg_sentiment_index)
      },
      {
        metric: "School Ranking",
        value: toScore(r.avg_school_ranking)
      },
      {
        metric: "Teacher Quality",
        value: toScore(r.avg_teacher_rate)
      },
      {
        metric: "Video Engagement",
        value: toScore(r.avg_video_engagement)
      },
      {
        metric: "Exercise Engagement",
        value: toScore(r.avg_exercise_engagement)
      }
    ];

    res.json(data);
  } catch (err) {
    console.error("Overall quality error:", err);
    res.status(500).json({ message: "Failed to load overall quality" });
  }
}

export async function getFinalRankDistribution(req, res) {
  try {
    const agg = await Course.aggregate([
      // Chỉ lấy rank hợp lệ 1..5
      {
        $match: {
          final_rank: { $gte: 1, $lte: 5 }
        }
      },
      // Đếm số course theo rank
      {
        $group: {
          _id: "$final_rank",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          rank: "$_id",
          count: 1
        }
      }
    ]);

    // Fill đủ 1..5 (nếu thiếu rank nào thì count = 0)
    const map = new Map(agg.map(x => [x.rank, x.count]));
    const result = [1, 2, 3, 4, 5].map(r => ({
      rank: r,
      count: map.get(r) || 0
    }));

    res.json(result);
  } catch (err) {
    console.error("Final rank distribution error:", err);
    res.status(500).json({ message: "Failed to load final rank distribution" });
  }
}

export async function getCourseMetricsByCourseId(req, res) {
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
       2️⃣ QUERY METRICS
    =============================== */
    const metrics = await CourseMetric.find(match)
      .sort({ relative_week: 1 })
      .lean();

    res.json(metrics);
  } catch (err) {
    console.error("getCourseMetricsByCourseId error:", err);
    res.status(500).json({
      message: "Failed to load course metrics"
    });
  }
}
