import express from "express";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";
import cors from "cors";

import courseRoutes from "./src/routes/course.route.js";
import courseWeekRoutes from "./src/routes/courseWeek.route.js";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());

// ===== CONNECT DB =====
connectDB();

// ===== ROUTES =====
app.use("/courses", courseRoutes);
app.use("/coursesWeek", courseWeekRoutes);

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
