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
const PROXIES_FILE = path.join(__dirname, "proxies.txt");

// 🔥 Helper to get a random proxy from proxies.txt
const getRandomProxy = () => {
    // If a global PROXY_URL is set in environment, use it first
    if (process.env.PROXY_URL) return process.env.PROXY_URL;

    // Otherwise, pick from proxies.txt
    if (fs.existsSync(PROXIES_FILE)) {
        try {
            const data = fs.readFileSync(PROXIES_FILE, "utf-8");
            const lines = data.split("\n").filter(line => line.trim() && !line.startsWith("#"));
            if (lines.length > 0) {
                const randomLine = lines[Math.floor(Math.random() * lines.length)].trim();
                // Ensure it has a protocol
                return randomLine.includes("://") ? randomLine : `http://${randomLine}`;
            }
        } catch (e) {
            console.error("Error reading proxies.txt:", e);
        }
    }
    return null;
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const runYtDlp = (args, proxy = null) => {
    const finalArgs = [...args];
    if (proxy) {
        finalArgs.push("--proxy", proxy);
    }

    return new Promise((resolve, reject) => {
        // 50MB buffer to handle large JSON metadata
        execFile(YTDLP, finalArgs, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

app.get("/", (req, res) => {
    const hasProxies = fs.existsSync(PROXIES_FILE);
    res.json({
        message: "🚀 Multi-Proxy Optimized Downloader API is Running",
        proxy_rotation: hasProxies ? "✅ Enabled" : "❌ Disabled (proxies.txt missing)",
        yt_dlp_version: "latest"
    });
});

// INFO API
app.get("/info", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    const proxy = getRandomProxy();
    console.log(`[INFO] Fetching: ${url} | Proxy: ${proxy || "None"}`);

    try {
        const args = [
            url,
            "--dump-single-json",
            "--no-warnings",
            "--no-check-certificates",
            "--no-playlist",
            "--user-agent", USER_AGENT,
            "--impersonate", "chrome",
            "--extractor-args", "instagram:allow_direct_url"
        ];

        let output = await runYtDlp(args, proxy);
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
        console.error("❌ Info fetch failed. Attempting fallback...");

        // FALLBACK: Try to get just the direct link (often works when full JSON fails)
        try {
            const fallbackArgs = [url, "-g", "--no-warnings", "--user-agent", USER_AGENT, "--impersonate", "chrome"];
            let link = await runYtDlp(fallbackArgs, proxy);
            const links = link.trim().split('\n');

            return res.json({
                success: true,
                fallback: true,
                title: "Media Found (Limited Info)",
                download_url: links[0],
                audio_url: links.length > 1 ? links[1] : null
            });

        } catch (err2) {
            return res.status(500).json({
                error: "Blocked or Site Error",
                details: "The server IP or proxy is likely blocked. Try a different URL or proxy.",
                debug: err.toString().split('\n')[0]
            });
        }
    }
});

// DOWNLOAD API
app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    const proxy = getRandomProxy();
    try {
        const args = [url, "-g", "--no-warnings", "--user-agent", USER_AGENT, "--impersonate", "chrome"];
        if (format) args.push("-f", format);

        const output = await runYtDlp(args, proxy);
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
    console.log(`🔥 Server running on port ${PORT}`);
    console.log(`📁 Proxy list: ${fs.existsSync(PROXIES_FILE) ? "Found" : "Missing"}`);
});
