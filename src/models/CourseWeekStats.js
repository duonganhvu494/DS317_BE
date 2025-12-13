import mongoose from "mongoose";

const CourseWeekStatsSchema = new mongoose.Schema({
  course_id: { type: String, index: true },
  week: Number,

  enrollment: {
    new: Number,
    dropout: Number,
    cumulative: Number
  },

  engagement: {
    comments: Number,
    weekly_submits: Number,
    cum_submits: Number
  },

  sentiment: {
    pos: Number,
    neg: Number,
    neu: Number,
    avg: Number,
    exp_avg: Number,
    exp_prob: Number
  },

  video: {
    pauses: Number,
    skips: Number,
    watch_time: Number,
    real_time: Number,
    completion_rate: Number,
    mean_speed: Number
  },

  cumulative: {
    views: Number,
    watch_time: Number,
    comments: Number
  }
}, { versionKey: false });

CourseWeekStatsSchema.index(
  { course_id: 1, week: 1 },
  { unique: true }
);

export default mongoose.model(
  "CourseWeekStats",
  CourseWeekStatsSchema
);
