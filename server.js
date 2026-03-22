const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());app.use(express.json());

const PORT = process.env.PORT || 8000;
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const PROXIES_FILE = path.join(__dirname, "proxies.txt");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

// 🔥 Helper to get a random proxy
const getRandomProxy = () => {
    if (process.env.PROXY_URL) return process.env.PROXY_URL;
    if (fs.existsSync(PROXIES_FILE)) {
        try {
            const lines = fs.readFileSync(PROXIES_FILE, "utf-8").split("\n").filter(l => l.trim());
            if (lines.length > 0) {
                const proxy = lines[Math.floor(Math.random() * lines.length)].trim();
                return proxy.includes("://") ? proxy : `http://${proxy}`;
            }
        } catch (e) { console.error("Proxy Read Error"); }
    }
    return null;
};

// 🔥 Run yt-dlp with a promise
const runYtDlp = (args, proxy = null) => {
    const finalArgs = [...args];
    if (proxy) finalArgs.push("--proxy", proxy);

    return new Promise((resolve, reject) => {
        execFile(YTDLP, finalArgs, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
        });
    });
};

app.get("/", (req, res) => {
    res.json({ message: "🚀 Multi-Proxy Downloader Active", proxies: fs.existsSync(PROXIES_FILE) });
});

// INFO API with Auto-Retry Logic
app.get("/info", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    let attempts = 0;
    const maxAttempts = 3; // Retry 3 times with different proxies

    const fetchInfo = async () => {
        const proxy = getRandomProxy();
        console.log(`[Attempt ${attempts + 1}] Trying with Proxy: ${proxy || "Local IP"}`);

        try {
            const args = [
                url, "--dump-single-json", "--no-warnings", "--no-playlist",
                "--user-agent", USER_AGENT, "--impersonate", "chrome",
                "--extractor-args", "instagram:allow_direct_url"
            ];
            const output = await runYtDlp(args, proxy);
            return JSON.parse(output);
        } catch (err) {
            attempts++;
            if (attempts < maxAttempts) {
                return await fetchInfo(); // Recursive retry
            }
            throw err; // All retries failed
        }
    };

    try {
        const data = await fetchInfo();
        const formats = (data.formats || [])
            .filter(f => f.url && (f.vcodec !== 'none' || f.acodec !== 'none'))
            .map(f => ({
                format_id: f.format_id,
                quality: f.format_note || `${f.height}p`,
                ext: f.ext,
                url: f.url
            })).reverse();

        res.json({ title: data.title, thumbnail: data.thumbnail, formats });

    } catch (err) {
        console.error("❌ All attempts failed. Trying final fallback without proxy...");
        try {
            const fallbackArgs = [url, "-g", "--user-agent", USER_AGENT, "--impersonate", "chrome"];
            const link = await runYtDlp(fallbackArgs, null);
            res.json({ fallback: true, download_url: link.trim().split('\n')[0] });
        } catch (err2) {
            res.status(500).json({ error: "Site Blocked", details: "All proxies and Local IP are blocked.", debug: err.toString().split('\n')[0] });
        }
    }
});

app.get("/download", async (req, res) => {
    const { url, format } = req.query;
    const proxy = getRandomProxy();
    try {
        const args = [url, "-g", "--user-agent", USER_AGENT, "--impersonate", "chrome"];
        if (format) args.push("-f", format);
        const output = await runYtDlp(args, proxy);
        res.json({ download_url: output.trim().split('\n')[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed", details: err.toString().split('\n')[0] });
    }
});

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));