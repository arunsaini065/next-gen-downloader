const express = require("express");
const cors = require("cors");

// ✅ system yt-dlp use karega (IMPORTANT)
const ytdlp = require("yt-dlp-exec").create("yt-dlp");
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// ✅ Home route
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// 🔍 Video Info API
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
                ?.filter(f => f.ext === "mp4" && f.url)
                .map(f => ({
                    format_id: f.format_id,
                    quality: f.format_note || f.height + "p",
                    url: f.url
                }))
        });

    } catch (err) {
        console.log("INFO ERROR:", err);

        res.status(500).json({
            error: "Failed to fetch info",
            details: err.message
        });
    }
});

// ⬇️ Download API
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
        console.log("DOWNLOAD ERROR:", err);

        res.status(500).json({
            error: "Download failed",
            details: err.message
        });
    }
});

// 🚀 Server start
app.listen(PORT, () => {
    console.log(`🔥 Server running at http://localhost:${PORT}`);
});