import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    name: String,
    name_en: String,

    field: [String],
    field_en: [String],

    about: String,
    about_en: String,

    school: [String],
    teacher: [String],

    course_duration: Number,

    sentiment_index: Number,
    completion_rate: Number,
    video_engagement: Number,
    exercise_engagement: Number,

    school_ranking: Number,
    teacher_rate: Number,

    cluster: Number,
    final_rank: Number,

    num_students: {
      enroll: Number,
      dropout: Number
    },

    sum_relative_week: Number
  },
  { timestamps: true }
);

/* =========================
   INDEXES
========================= */

// ✅ Filter theo field
CourseSchema.index({ field_en: 1 });

// ✅ Filter theo school
CourseSchema.index({ school: 1 });

export default mongoose.model("Course", CourseSchema);
