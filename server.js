const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// 🔥 Modern User-Agent to avoid blocks
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// 🔥 Secure helper function using execFile
const runYtDlp = (args) => {
    return new Promise((resolve, reject) => {
        execFile(YTDLP, args, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

// Home
app.get("/", (req, res) => {
    res.send("🚀 Next-Gen Downloader API is Running");
});

// INFO API
app.get("/info", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const args = [
            url,
            "--dump-single-json",
            "--no-warnings",
            "--no-check-certificates",
            "--no-playlist",
            "--user-agent", USER_AGENT
        ];

        // 🍪 Agar aapke paas cookies.txt hai, toh niche wali line uncomment karein:
        // args.push("--cookies", path.join(__dirname, "cookies.txt"));

        let output = await runYtDlp(args);
        let data = JSON.parse(output);

        // Filter formats to get usable links
        const formats = (data.formats || [])
            .filter(f => f.url && (f.vcodec !== 'none' || f.acodec !== 'none'))
            .map(f => ({
                format_id: f.format_id,
                quality: f.format_note || `${f.height}p` || 'unknown',
                ext: f.ext,
                url: f.url,
                filesize: f.filesize || f.filesize_approx || null
            }))
            .reverse();

        return res.json({
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            uploader: data.uploader,
            formats: formats
        });

    } catch (err) {
        console.error("❌ Info fetch failed:", err);

        // Fallback: Try to get a direct URL if full info fails
        try {
            const fallbackArgs = [url, "-g", "--no-warnings", "--user-agent", USER_AGENT];
            // args.push("--cookies", path.join(__dirname, "cookies.txt"));

            let link = await runYtDlp(fallbackArgs);

            return res.json({
                fallback: true,
                title: "Media Found",
                download_url: link.trim()
            });

        } catch (err2) {
            return res.status(500).json({
                error: "Failed to fetch info",
                details: err2.toString().split('\n')[0] // Clean error message
            });
        }
    }
});

// DOWNLOAD API
app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const args = [url, "-g", "--no-warnings", "--user-agent", USER_AGENT];
        if (format) {
            args.push("-f", format);
        }

        // args.push("--cookies", path.join(__dirname, "cookies.txt"));

        const output = await runYtDlp(args);
        res.json({ download_url: output.trim() });

    } catch (err) {
        res.status(500).json({
            error: "Download failed",
            details: err.toString().split('\n')[0]
        });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});
