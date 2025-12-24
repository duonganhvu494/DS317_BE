import mongoose from "mongoose";

const CourseMetricSchema = new mongoose.Schema(
  {
    course_id: {
      type: String,
      required: true
    },

    relative_week: {
      type: Number,
      required: true
    },

    weekly_submit_count: Number,
    cum_weekly_submit_count: Number,

    comments_count: Number,
    cum_comments: Number,

    avg_sentiment: Number,
    exp_avg_sentiment: Number,

    avg_assignment_score: Number,
    exp_avg_prob_score: Number,

    total_watch_time: Number,
    completion_rate: Number,

    exercise_engagement_week: Number,
    new_enrolls: Number,
    dropout_count: Number
  },
  { timestamps: true }
);

/* =========================
   INDEXES (CỰC QUAN TRỌNG)
========================= */

// ✅ Chống trùng dữ liệu (bạn làm đúng)
CourseMetricSchema.index(
  { course_id: 1, relative_week: 1 },
  { unique: true }
);

// ✅ Tối ưu query theo tuần (API progress)
CourseMetricSchema.index({ relative_week: 1 });

// ✅ Tối ưu lookup + filter
CourseMetricSchema.index({ course_id: 1 });

export default mongoose.model("CourseMetric", CourseMetricSchema);
