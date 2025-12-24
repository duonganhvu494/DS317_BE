import fs from "fs";
import csv from "csv-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";

import CourseMetric from "../models/CourseMetric.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  // 🔥 Map để aggregate theo (course_id, relative_week)
  const weeklyMap = new Map();

  fs.createReadStream("src/data/backend_realtime_data.csv")
    .pipe(csv())
    .on("data", row => {
      const courseId = row.course_id;
      const week = Number(row.Relative_Week);
      const key = `${courseId}_${week}`;

      if (!weeklyMap.has(key)) {
        weeklyMap.set(key, {
          course_id: courseId,
          relative_week: week,

          // SUM
          weekly_submit_count: 0,
          comments_count: 0,
          dropout_count: 0,
          new_enrolls: 0,
          total_watch_time: 0,

          // WEIGHTED AVG
          assignment_score_sum: 0,
          assignment_score_weight: 0,

          sentiment_sum: 0,
          sentiment_weight: 0,

          // LAST VALUE
          cum_weekly_submit_count: 0,
          cum_comments: 0,
          cum_enrolls: 0,

          // optional
          completion_rate: 0,
          exercise_engagement_week: 0,
          exp_avg_sentiment: 0,
          exp_avg_prob_score: 0
        });
      }

      const w = weeklyMap.get(key);

      const submits = Number(row.weekly_submit_count || 0);
      const comments = Number(row.comments_count || 0);

      // ===== SUM =====
      w.weekly_submit_count += submits;
      w.comments_count += comments;
      w.dropout_count += Number(row.dropout_count || 0);
      w.new_enrolls += Number(row.new_enrolls || 0);
      w.total_watch_time += Number(row.total_watch_time || 0);

      // ===== WEIGHTED AVG =====
      if (submits > 0) {
        w.assignment_score_sum +=
          Number(row.avg_assignment_score || 0) * submits;
        w.assignment_score_weight += submits;
      }

      if (comments > 0) {
        w.sentiment_sum +=
          Number(row.avg_sentiment || 0) * comments;
        w.sentiment_weight += comments;
      }

      // ===== LAST VALUE (cumulative & snapshot) =====
      w.cum_weekly_submit_count = Number(
        row.cum_weekly_submit_count || w.cum_weekly_submit_count
      );

      w.cum_comments = Number(
        row.cum_comments || w.cum_comments
      );

      w.cum_enrolls = Number(
        row.cum_enrolls || w.cum_enrolls
      );

      w.completion_rate = Number(
        row.completion_rate || w.completion_rate
      );

      w.exercise_engagement_week = Number(
        row.exercise_engagement_week || w.exercise_engagement_week
      );

      w.exp_avg_sentiment = Number(
        row.exp_avg_sentiment || w.exp_avg_sentiment
      );

      w.exp_avg_prob_score = Number(
        row.exp_avg_prob_score || w.exp_avg_prob_score
      );
    })
    .on("end", async () => {
      try {
        const ops = [];

        for (const w of weeklyMap.values()) {
          ops.push({
            updateOne: {
              filter: {
                course_id: w.course_id,
                relative_week: w.relative_week
              },
              update: {
                $set: {
                  course_id: w.course_id,
                  relative_week: w.relative_week,

                  weekly_submit_count: w.weekly_submit_count,
                  comments_count: w.comments_count,
                  dropout_count: w.dropout_count,
                  new_enrolls: w.new_enrolls,
                  total_watch_time: w.total_watch_time,

                  avg_assignment_score:
                    w.assignment_score_weight > 0
                      ? w.assignment_score_sum /
                        w.assignment_score_weight
                      : 0,

                  avg_sentiment:
                    w.sentiment_weight > 0
                      ? w.sentiment_sum /
                        w.sentiment_weight
                      : 0,

                  cum_weekly_submit_count: w.cum_weekly_submit_count,
                  cum_comments: w.cum_comments,
                  cum_enrolls: w.cum_enrolls,

                  completion_rate: w.completion_rate,
                  exercise_engagement_week:
                    w.exercise_engagement_week,

                  exp_avg_sentiment: w.exp_avg_sentiment,
                  exp_avg_prob_score: w.exp_avg_prob_score
                }
              },
              upsert: true
            }
          });
        }

        await CourseMetric.bulkWrite(ops, { ordered: false });
        console.log("🎉 Aggregated course metrics imported correctly");
      } catch (err) {
        console.error("❌ Import error:", err);
      } finally {
        process.exit(0);
      }
    });
}

run();
