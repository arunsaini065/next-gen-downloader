const express = require("express");
const cors = require("cors");

// 🔥 yt-dlp ka exact path
const ytdlp = require("yt-dlp-exec");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

// ✅ Home route
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// 🔍 Video info
app.get("/info", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
        });

        res.json({
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            formats: info.formats
                ?.filter(f => f.ext === "mp4")
                .map(f => ({
                    format_id: f.format_id,
                    quality: f.format_note,
                    url: f.url
                }))
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Failed to fetch info",
            details: err.message
        });
    }
});

// ⬇️ Download link
app.get("/download", async (req, res) => {
    const { url, format } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const videoUrl = await ytdlp(url, {
            getUrl: true,
            format: format || "best"
        });

        res.json({
            download_url: videoUrl
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Download failed",
            details: err.message
        });
    }
});

// 🔥 IMPORTANT (Koyeb ke liye)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🔥 Server running on port ${PORT}`);
});