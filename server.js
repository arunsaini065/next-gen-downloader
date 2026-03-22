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

// 🔥 Environment variable for Proxy (e.g., http://user:pass@host:port)
const PROXY = process.env.PROXY_URL || null;

// 🔥 Advanced Human-like User-Agent
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const runYtDlp = (args) => {
    // Add proxy to args if configured in environment
    if (PROXY) {
        args.push("--proxy", PROXY);
    }

    return new Promise((resolve, reject) => {
        // High maxBuffer (50MB) for large metadata
        execFile(YTDLP, args, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

app.get("/", (req, res) => {
    res.send("🚀 Universal Optimized Downloader API is Running");
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
            "--geo-bypass", // Helps bypass regional blocks
            "--user-agent", USER_AGENT,
            "--impersonate", "chrome", // 🕵️ Critical: Bypasses many bot detectors
            "--add-header", "Accept-Language: en-US,en;q=0.9",
            "--add-header", "Sec-Fetch-Mode: navigate",
            "--extractor-args", "instagram:allow_direct_url"
        ];

        // 🍪 Cookies: Optional (Uses if file exists, but tries to work without it)
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
        console.error("❌ Fetch failed:", err);

        // FALLBACK: Fast URL extraction
        try {
            const fallbackArgs = [
                url, "-g",
                "--no-warnings",
                "--user-agent", USER_AGENT,
                "--impersonate", "chrome",
                "--geo-bypass"
            ];

            const cookiesPath = path.join(__dirname, "cookies.txt");
            if (fs.existsSync(cookiesPath)) fallbackArgs.push("--cookies", cookiesPath);

            let link = await runYtDlp(fallbackArgs);
            const links = link.trim().split('\n');

            return res.json({
                success: true,
                fallback: true,
                title: "Media Found",
                download_url: links[0],
                audio_url: links.length > 1 ? links[1] : null
            });

        } catch (err2) {
            return res.status(500).json({
                error: "Request Blocked by Site",
                details: "Try again in a few minutes. Some sites like Instagram strictly block server IPs without cookies.",
                debug: err.toString().split('\n')[0]
            });
        }
    }
});

// DOWNLOAD API
app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const args = [url, "-g", "--no-warnings", "--user-agent", USER_AGENT, "--impersonate", "chrome"];
        if (format) args.push("-f", format);

        const cookiesPath = path.join(__dirname, "cookies.txt");
        if (fs.existsSync(cookiesPath)) args.push("--cookies", cookiesPath);

        const output = await runYtDlp(args);
        const links = output.trim().split('\n');
        res.json({ download_url: links[0] });

    } catch (err) {
        res.status(500).json({
            error: "Download failed",
            details: err.toString().split('\n')[0]
        });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Optimized Server running on port ${PORT}`);
});
