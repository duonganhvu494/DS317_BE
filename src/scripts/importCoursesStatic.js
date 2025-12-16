import fs from "fs";
import csv from "csv-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";

import Course from "../models/Course.js";

dotenv.config();

function parseArray(str) {
  if (!str) return [];
  try {
    return JSON.parse(
      str.replace(/'/g, '"')
    );
  } catch {
    return [];
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const ops = [];

  fs.createReadStream("src/data/backend_static_data.csv")
    .pipe(csv())
    .on("data", (row) => {
      ops.push({
        updateOne: {
          filter: { _id: row.course_id },
          update: {
            $set: {
              _id: row.course_id,

              name: row.name,
              name_en: row.name_en,

              field: parseArray(row.field),
              field_en: parseArray(row.field_en),

              about: row.about,
              about_en: row.about_en,

              school: parseArray(row.school),
              teacher: parseArray(row.teacher),

              course_duration: Number(row.course_duration),

              sentiment_index: Number(row.sentiment_index),
              completion_rate: Number(row.completion_rate),
              video_engagement: Number(row.video_engagement),
              exercise_engagement: Number(row.exercise_engagement),

              school_ranking: Number(row.school_ranking),
              teacher_rate: Number(row.teacher_rate),

              cluster: Number(row.cluster),
              final_rank: Number(row.final_rank),

              num_students: {
                enroll: Number(row.num_students_enroll),
                dropout: Number(row.num_students_dropout)
              },

              sum_relative_week: Number(row.sum_relative_week)
            }
          },
          upsert: true
        }
      });
    })
    .on("end", async () => {
      await Course.bulkWrite(ops, { ordered: false });
      console.log("🎉 Course static data imported");
      process.exit(0);
    });
}

run();
