import Course from "../models/Course.js";

/**
 * GET /api/courses
 * Query:
 *  - page (default 1)
 *  - limit (default 20)
 *  - field
 *  - school
 *  - sort (final_rank | completion_rate | sentiment_index)
 */
export async function getAllCourses(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      field,
      school,
      search,
      sortBy = "name_en",
      sortOrder = "asc"
    } = req.query;

    // ===== FILTER =====
    const filter = {};

    if (field) filter.field_en = field;
    if (school) filter.school = school;

    // ===== SEARCH =====
    if (search) {
      filter.name_en = {
        $regex: search,
        $options: "i"
      };
    }

    // ===== SORT (WHITELIST) =====
    const SORT_FIELDS = [
      "name_en",
      "completion_rate",
      "sentiment_index",
      "final_rank",
      "num_students"
    ];

    const sortField = SORT_FIELDS.includes(sortBy)
      ? sortBy
      : "name_en";

    const sort = {
      [sortField]: sortOrder === "desc" ? -1 : 1
    };

    // ===== PAGINATION =====
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .select(
          "_id name_en field_en school teacher completion_rate sentiment_index final_rank num_students"
        )
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Course.countDocuments(filter)
    ]);

    res.json({
      data: courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error("getAllCourses error:", err);
    res.status(500).json({ message: err.message });
  }
}


/**
 * GET /api/courses/:id
 * Course detail
 */
export async function getCourseById(req, res) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
export const getCourses = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = req.query.search?.trim() || "";
    const sortBy = req.query.sortBy || "name_en";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    // ===== SEARCH QUERY =====
    const query = search
      ? {
          name_en: { $regex: search, $options: "i" }
        }
      : {};

    // ===== SORT =====
    const sort = {
      [sortBy]: sortOrder
    };

    // ===== QUERY DB =====
    const [data, total] = await Promise.all([
      Course.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(query)
    ]);

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total
      }
    });
  } catch (err) {
    console.error("GET /courses error:", err);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

/**
 * GET /api/courses/filter?field=&school=
 */
export async function filterCourses(req, res) {
  try {
    const { field, school } = req.query;

    const query = {};

    if (field) query.field = field;
    if (school) query.school = school;

    const courses = await Course.find(query);

    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * GET /api/courses/stats/overview
 * Dashboard KPIs
 */
export async function getOverviewStats(req, res) {
  try {
    const { field, school } = req.query;

    const match = {};

    if (field) {
      match.field_en = field;
    }

    if (school) {
      match.school = school;
    }

    const stats = await Course.aggregate([
      {
        $match: match    // ⭐ FILTER TRƯỚC
      },
      {
        $group: {
          _id: null,
          total_courses: { $sum: 1 },

          avg_completion: { $avg: "$completion_rate" },
          avg_sentiment: { $avg: "$sentiment_index" },

          avg_video_engagement: { $avg: "$video_engagement" },
          avg_exercise_engagement: { $avg: "$exercise_engagement" },

          total_students: {
            $sum: "$num_students.enroll"
          }
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


/**
 * GET /api/courses/danger
 * ?threshold=3
 * ?field=Computer Science
 * ?school=Tsinghua University
 * ?page=1
 * ?limit=20
 */
export async function getCourseDanger(req, res) {
  try {
    const {
      threshold = 3,
      field,
      school,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {
      final_rank: { $lte: Number(threshold) }
    };

    if (field) filter.field_en = field;
    if (school) filter.school = school;

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      Course.find(filter)
        .sort({ final_rank: 1 })
        .skip(skip)
        .limit(Number(limit)),

      Course.countDocuments(filter)
    ]);

    res.json({
      data,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

let filterCache = null;
let filterCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 phút

export async function getCourseFilters(req, res) {
  try {
    // ✅ 1. Nếu cache còn hạn → trả ngay
    if (
      filterCache &&
      Date.now() - filterCacheTime < CACHE_TTL
    ) {
      return res.json(filterCache);
    }

    // ✅ 2. Cache hết hạn → query DB
    const [fields, schools] = await Promise.all([
      Course.distinct("field_en"),
      Course.distinct("school")
    ]);

    const result = {
      fields: fields.flat().filter(Boolean),
      schools: schools.flat().filter(Boolean)
    };

    // ✅ 3. Lưu cache
    filterCache = result;
    filterCacheTime = Date.now();

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

