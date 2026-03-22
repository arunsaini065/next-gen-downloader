const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// 🔥 Modern Headers & User-Agent to mimic a real browser
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const runYtDlp = (args) => {
    return new Promise((resolve, reject) => {
        execFile(YTDLP, args, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

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
            "--user-agent", USER_AGENT,
            "--impersonate", "chrome", // 🕵️ Critical: Mimics Chrome browser behavior
            "--add-header", "Accept-Language: en-US,en;q=0.9",
            "--add-header", "Referer: https://www.google.com/"
        ];

        // 🍪 Cookies: Check if cookies.txt exists in the app directory
        const cookiesPath = path.join(__dirname, "cookies.txt");
        if (fs.existsSync(cookiesPath)) {
            args.push("--cookies", cookiesPath);
        }

        let output = await runYtDlp(args);
        let data = JSON.parse(output);

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

        // Fallback: Just try to get a direct URL if full info fails
        try {
            const fallbackArgs = [
                url, "-g",
                "--no-warnings",
                "--user-agent", USER_AGENT,
                "--impersonate", "chrome"
            ];

            const cookiesPath = path.join(__dirname, "cookies.txt");
            if (fs.existsSync(cookiesPath)) {
                fallbackArgs.push("--cookies", cookiesPath);
            }

            let link = await runYtDlp(fallbackArgs);
            return res.json({
                fallback: true,
                title: "Media Found",
                download_url: link.trim().split('\n')[0]
            });

        } catch (err2) {
            return res.status(500).json({
                error: "Instagram is blocking the request",
                details: "Public content is often restricted on server IPs. Please provide a cookies.txt file."
            });
        }
    }
});

// DOWNLOAD API
app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const args = [
            url, "-g",
            "--no-warnings",
            "--user-agent", USER_AGENT,
            "--impersonate", "chrome"
        ];

        if (format) args.push("-f", format);

        const cookiesPath = path.join(__dirname, "cookies.txt");
        if (fs.existsSync(cookiesPath)) {
            args.push("--cookies", cookiesPath);
        }

        const output = await runYtDlp(args);
        res.json({ download_url: output.trim().split('\n')[0] });

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
