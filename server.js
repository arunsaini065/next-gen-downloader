const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

// 🔥 IMPORTANT (auto detect)
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// Debug (remove later)
exec("which yt-dlp", (e, out) => {
    console.log("YT-DLP PATH:", out);
});

// Home
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// INFO
app.get("/info", (req, res) => {
    const url = req.query.url;

    if (!url) return res.status(400).json({ error: "URL required" });

    const cmd = `${YTDLP} "${url}" --dump-single-json --no-warnings --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" --add-header "accept-language:en-US,en;q=0.9" --add-header "referer:https://www.instagram.com/" --extractor-args "instagram:api_version=v1;dailymotion:impersonate=false"`;

    exec(cmd, { maxBuffer: 1024 * 5000 }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({
                error: "Failed to fetch info",
                details: stderr
            });
        }

        const data = JSON.parse(stdout);

        res.json({
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            formats: data.formats
                ?.filter(f => f.ext === "mp4")
                .map(f => ({
                    format_id: f.format_id,
                    quality: f.format_note,
                    url: f.url
                }))
        });
    });
});

// DOWNLOAD
app.get("/download", (req, res) => {
    const { url, format } = req.query;

    if (!url) return res.status(400).json({ error: "URL required" });

    const cmd = `${YTDLP} "${url}" -f ${format || "best"} -g --no-warnings --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" --add-header "accept-language:en-US,en;q=0.9" --add-header "referer:https://www.instagram.com/" --extractor-args "instagram:api_version=v1;dailymotion:impersonate=false"`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({
                error: "Download failed",
                details: stderr
            });
        }

        res.json({ download_url: stdout.trim() });
    });
});

app.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});
