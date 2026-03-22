const express = require("express");
const cors = require("cors");
const ytdlp = require("yt-dlp-exec");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

// ✅ Home
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// 🔍 Video Info
app.get("/info", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noWarnings: true,

            // 🔥 FIXES
            noCheckCertificates: true,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

            // ❗ IMPORTANT (impersonation disable)
            extractorArgs: "generic:impersonate=false"
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

// ⬇️ Download
app.get("/download", async (req, res) => {
    const { url, format } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const videoUrl = await ytdlp(url, {
            getUrl: true,
            format: format || "best",

            // same fixes
            noCheckCertificates: true,
            userAgent: "Mozilla/5.0",
            extractorArgs: "generic:impersonate=false"
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

// 🔥 Koyeb fix
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🔥 Server running on port ${PORT}`);
});