import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema({
  _id: String, // course_id

  school_ranking: Number,
  teacher_rate: Number,

  num_resource: Number,
  num_videos: Number,
  num_chapters: Number,
  num_subchapters: Number,
  course_duration: Number,

  num_concepts: Number,
  num_ex: Number,
  num_problem: Number,

  score_title: Number,
  score_org: Number,

  feat_bio_len: Number,
  feat_has_research: Boolean,
  feat_is_top_grad: Boolean,

  final_rank: Number
}, { versionKey: false });

export default mongoose.model("Course", CourseSchema);
