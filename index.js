import express from "express";
import yts from "yt-search";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// 🔥 MIDDLEWARE (Speed + Security)
// =============================
app.use(helmet());
app.use(compression());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40
});
app.use(limiter);

// Koyeb proxy fix
app.set("trust proxy", 1);

// =============================
// ⚡ CACHE SYSTEM
// =============================
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 min
const MAX_CACHE = 100;

// Auto cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.time > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60000);

// =============================
// 🚀 ROUTES
// =============================

// Root
app.get("/", (req, res) => {
  res.send("🚀 MR RABBIT Ultra Fast YouTube API Running...");
});

// Ping (uptime)
app.get("/ping", (req, res) => {
  res.json({
    status: true,
    message: "Alive ✅",
    uptime: process.uptime(),
    time: new Date()
  });
});

// 🔥 SEARCH API
app.get("/search", async (req, res) => {
  try {
    let query = req.query.q;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Query missing!"
      });
    }

    // normalize
    query = query.toLowerCase().trim();

    // cache hit
    if (cache.has(query)) {
      return res.json({
        ...cache.get(query).data,
        cached: true
      });
    }

    // search
    const result = await yts(query);

    let videos = result.videos.slice(0, 10).map((v, i) => ({
      id: v.videoId,
      title: v.title || `Song ${i + 1}`,
      url: v.url,
      duration: v.timestamp || "0:00",
      seconds: v.seconds || 0,
      views: v.views || 0,
      ago: v.ago || "",
      thumbnail: v.thumbnail || "",
      author: v.author?.name || "Unknown"
    }));

    // ensure 10 results
    while (videos.length < 10) {
      videos.push({
        id: null,
        title: `Song ${videos.length + 1}`,
        url: "N/A",
        duration: "0:00",
        seconds: 0,
        views: 0,
        ago: "",
        thumbnail: "",
        author: "Unknown"
      });
    }

    const response = {
      status: true,
      creator: "MR RABBIT",
      total: videos.length,
      cached: false,
      result: videos
    };

    // cache control
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(query, {
      data: response,
      time: Date.now()
    });

    res.json(response);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err.message
    });
  }
});

// =============================
// 🚀 START SERVER
// =============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
