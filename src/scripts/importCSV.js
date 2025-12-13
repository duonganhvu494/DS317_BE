import fs from "fs";
import csv from "csv-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Course from "../models/Course.js";
import CourseWeekStats from "../models/CourseWeekStats.js";

// ===== dotenv (fix path) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

// ===== CONFIG =====
const CSV_FILE = path.resolve(__dirname, "../data/train_data.csv");
const BATCH_SIZE = 5000;

// ===== HELPER =====
function initWeek(courseId, week, row) {
  return {
    course_id: courseId,
    week,

    enrollment: {
      new: Number(row.new_enrolls),
      dropout: 0,
      cumulative: Number(row.cum_enrolls)
    },

    engagement: {
      comments: 0,
      weekly_submits: 0,
      cum_submits: Number(row.cum_weekly_submit_count)
    },

    sentiment: {
      pos: 0,
      neg: 0,
      neu: 0,
      avg_sum: 0,
      avg_count: 0,
      exp_avg: Number(row.exp_avg_sentiment),
      exp_prob: Number(row.exp_avg_prob_score)
    },

    video: {
      pauses: 0,
      skips: 0,
      watch_time: 0,
      real_time: 0,
      completion_rate_sum: 0,
      completion_rate_count: 0,
      mean_speed_sum: 0,
      mean_speed_count: 0
    },

    cumulative: {
      views: Number(row.cum_view_count),
      watch_time: Number(row.cum_watch_time),
      comments: Number(row.cum_comments)
    }
  };
}

// ===== MAIN IMPORT FUNCTION =====
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  console.log("📂 Reading CSV:", CSV_FILE);

  const courseCache = new Set();
  const weekMap = new Map();

  let courseOps = [];
  let totalWeeks = 0;
  let rowCount = 0;

  const stream = fs.createReadStream(CSV_FILE).pipe(csv());

  for await (const row of stream) {
    rowCount++;
    if (rowCount === 1) console.log("🧪 First row:", row);

    const courseId = row.course_id;
    const week = Number(row.Relative_Week);
    const key = `${courseId}_${week}`;

    // ===== COURSE (STATIC) =====
    if (!courseCache.has(courseId)) {
      courseCache.add(courseId);

      courseOps.push({
        updateOne: {
          filter: { _id: courseId },
          update: {
            $setOnInsert: {
              _id: courseId,

              school_ranking: Number(row.school_ranking),
              teacher_rate: Number(row.teacher_rate),

              num_resource: Number(row.num_resource),
              num_videos: Number(row.num_videos),
              num_chapters: Number(row.num_chapters),
              num_subchapters: Number(row.num_subchapters),
              course_duration: Number(row.course_duration),

              num_concepts: Number(row.num_concepts),
              num_ex: Number(row.num_ex),
              num_problem: Number(row.num_problem),

              score_title: Number(row.score_title),
              score_org: Number(row.score_org),

              feat_bio_len: Number(row.feat_bio_len),
              feat_has_research: row.feat_has_research === "1",
              feat_is_top_grad: row.feat_is_top_grad === "1",

              final_rank: Number(row.final_rank)
            }
          },
          upsert: true
        }
      });
    }

    // ===== WEEK AGGREGATION =====
    if (!weekMap.has(key)) {
      weekMap.set(key, initWeek(courseId, week, row));
    }

    const w = weekMap.get(key);

    // SUM
    w.enrollment.dropout += Number(row.dropout_count);
    w.engagement.comments += Number(row.comments_count);
    w.engagement.weekly_submits += Number(row.weekly_submit_count);

    w.sentiment.pos += Number(row.pos_count);
    w.sentiment.neg += Number(row.neg_count);
    w.sentiment.neu += Number(row.neu_count);

    w.video.pauses += Number(row.video_pauses);
    w.video.skips += Number(row.video_skips);
    w.video.watch_time += Number(row.total_watch_time);
    w.video.real_time += Number(row.total_real_time);

    // AVG
    w.sentiment.avg_sum += Number(row.avg_sentiment);
    w.sentiment.avg_count += 1;

    w.video.completion_rate_sum += Number(row.completion_rate);
    w.video.completion_rate_count += 1;

    w.video.mean_speed_sum += Number(row.mean_speed);
    w.video.mean_speed_count += 1;

    // ===== BATCH FLUSH =====
    if (weekMap.size >= BATCH_SIZE) {
      console.log(`🚀 Flushing batch of ${weekMap.size} weeks...`);
      await flush(courseOps, weekMap);
      totalWeeks += weekMap.size;
      courseOps = [];
      weekMap.clear();
    }
  }

  // ===== FINAL FLUSH =====
  if (weekMap.size > 0 || courseOps.length > 0) {
    console.log("⚠️ Final flush triggered");
    await flush(courseOps, weekMap);
    totalWeeks += weekMap.size;
  }

  console.log(`🎉 DONE. Total rows read: ${rowCount}`);
  console.log(`📊 Total aggregated week docs: ${totalWeeks}`);

  process.exit(0);
}

// ===== FLUSH FUNCTION =====
async function flush(courseOps, weekMap) {
  if (courseOps.length > 0) {
    await Course.bulkWrite(courseOps, { ordered: false });
    console.log(`✅ Upserted ${courseOps.length} courses`);
  }

  const ops = [];

  for (const w of weekMap.values()) {
    ops.push({
      updateOne: {
        filter: { course_id: w.course_id, week: w.week },
        update: {
          $set: {
            course_id: w.course_id,
            week: w.week,

            enrollment: w.enrollment,
            engagement: w.engagement,

            sentiment: {
              pos: w.sentiment.pos,
              neg: w.sentiment.neg,
              neu: w.sentiment.neu,
              avg: w.sentiment.avg_sum / w.sentiment.avg_count,
              exp_avg: w.sentiment.exp_avg,
              exp_prob: w.sentiment.exp_prob
            },

            video: {
              pauses: w.video.pauses,
              skips: w.video.skips,
              watch_time: w.video.watch_time,
              real_time: w.video.real_time,
              completion_rate:
                w.video.completion_rate_sum /
                w.video.completion_rate_count,
              mean_speed:
                w.video.mean_speed_sum / w.video.mean_speed_count
            },

            cumulative: w.cumulative
          }
        },
        upsert: true
      }
    });
  }

  if (ops.length > 0) {
    await CourseWeekStats.bulkWrite(ops, { ordered: false });
    console.log(`✅ Wrote ${ops.length} weekly stats`);
  } else {
    console.log("⚠️ No weekly data to write in this batch");
  }
}

// ===== RUN SCRIPT =====
run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
