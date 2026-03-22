const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// 🔥 helper function
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 5000 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

// Home
app.get("/", (req, res) => {
    res.send("🚀 Downloader API Running");
});

// INFO API
app.get("/info", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        // 🔥 MAIN COMMAND (safe)
        const cmd = `${YTDLP} "${url}" --dump-single-json --no-warnings --no-check-certificates --user-agent "Mozilla/5.0"`;

        let output = await runCommand(cmd);
        let data = JSON.parse(output);

        return res.json({
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            formats: data.formats
                ?.filter(f => f.ext === "mp4" && f.url)
                .map(f => ({
                    format_id: f.format_id,
                    quality: f.format_note || f.height,
                    url: f.url
                }))
        });

    } catch (err) {
        console.log("❌ Primary failed:", err);

        // 🔥 FALLBACK (basic direct link)
        try {
            const fallbackCmd = `${YTDLP} "${url}" -g`;
            let link = await runCommand(fallbackCmd);

            return res.json({
                fallback: true,
                download_url: link.trim()
            });

        } catch (err2) {
            return res.status(500).json({
                error: "Failed to fetch info",
                details: err2
            });
        }
    }
});

// DOWNLOAD API
app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const cmd = `${YTDLP} "${url}" -f ${format || "best"} -g --no-warnings`;
        const output = await runCommand(cmd);

        res.json({ download_url: output.trim() });

    } catch (err) {
        res.status(500).json({
            error: "Download failed",
            details: err
        });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});