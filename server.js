const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

// 🔥 FIXED PATH
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// Debug (remove later)
exec(`which yt-dlp`, (e, out) => {
    console.log("YT-DLP PATH:", out);
});

// Home
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// INFO API
app.get("/info", (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    const cmd = `${YTDLP} -j "${url}" --no-warnings --no-check-certificates`;

    exec(cmd, { maxBuffer: 1024 * 5000 }, (err, stdout, stderr) => {
        if (err) {
            console.log(stderr);
            return res.status(500).json({
                error: "Failed to fetch info",
                details: stderr
            });
        }

        try {
            const data = JSON.parse(stdout);

            res.json({
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnail,
                uploader: data.uploader,
                formats: data.formats
                    ?.filter(f => f.ext === "mp4")
                    .map(f => ({
                        format_id: f.format_id,
                        quality: f.format_note,
                        url: f.url
                    }))
            });

        } catch (e) {
            res.status(500).json({ error: "Parsing failed" });
        }
    });
});

// DOWNLOAD API
app.get("/download", (req, res) => {
    const { url, format } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    const cmd = `${YTDLP} -f "${format || "best"}" -g "${url}"`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log(stderr);
            return res.status(500).json({
                error: "Download failed",
                details: stderr
            });
        }

        res.json({
            download_url: stdout.trim()
        });
    });
});

app.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});