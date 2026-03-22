const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

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

    const command = `yt-dlp -j "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(stderr);
            return res.status(500).json({
                error: "Failed to fetch info",
                details: stderr
            });
        }

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
    });
});

// DOWNLOAD API
app.get("/download", (req, res) => {
    const { url, format } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL required" });
    }

    const command = `yt-dlp -f "${format || "best"}" -g "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
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