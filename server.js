const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.set('socketio', io);

const PORT = process.env.PORT || 8000;
const downloadsDir = path.join(__dirname, 'downloads');

// Ensure downloads directory exists
fs.ensureDirSync(downloadsDir);

// Home route
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// GET /info - Fetch video information (keeping from previous version)
app.get("/info", (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    const cmd = `yt-dlp "${url}" --dump-single-json --no-warnings --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" --add-header "accept-language:en-US,en;q=0.9" --add-header "referer:https://www.instagram.com/" --extractor-args "instagram:api_version=v1;dailymotion:impersonate=false"`;

    exec(cmd, { maxBuffer: 1024 * 5000 }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch info", details: stderr });
        }
        try {
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
        } catch (e) {
            res.status(500).json({ error: "Failed to parse info" });
        }
    });
});

// Download Routes (Integrated from your script)
const downloadRouter = express.Router();

// POST /api/download
downloadRouter.post('/', async (req, res) => {
  try {
    const { url, format, quality, audioOnly } = req.body;
    const io = req.app.get('socketio');

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(url)) {
      return res.status(400).json({ error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.' });
    }

    // Build yt-dlp command
    const args = [];
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');

    if (audioOnly) {
      args.push('-f', 'bestaudio/best');
      args.push('--extract-audio');
      args.push('--audio-format', format || 'mp3');
    } else {
      if (quality && quality !== 'best') {
        args.push('-f', `best[height<=${quality}]/best`);
      } else {
        args.push('-f', 'b');
      }
    }

    args.push('-o', path.join(downloadsDir, '%(title)s.%(ext)s'));
    args.push('--no-playlist');
    args.push('--progress');
    args.push(url);

    const downloadId = Date.now().toString();
    const ytdlp = spawn('yt-dlp', args);

    let downloadInfo = {
      id: downloadId,
      url,
      status: 'starting',
      progress: 0,
      filename: '',
      error: null
    };

    io.emit('download-start', downloadInfo);

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      const progressMatch = output.match(/(\d+\.\d+)%/);
      if (progressMatch) {
        downloadInfo.progress = parseFloat(progressMatch[1]);
        downloadInfo.status = 'downloading';
        io.emit('download-progress', downloadInfo);
      }
      const filenameMatch = output.match(/\[download\] Destination: (.+)/);
      if (filenameMatch) {
        downloadInfo.filename = path.basename(filenameMatch[1]);
      }
    });

    ytdlp.stderr.on('data', (data) => {
      console.error('yt-dlp stderr:', data.toString());
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        downloadInfo.status = 'completed';
        downloadInfo.progress = 100;
        io.emit('download-complete', downloadInfo);
      } else {
        downloadInfo.status = 'error';
        downloadInfo.error = `Process exited with code ${code}`;
        io.emit('download-error', downloadInfo);
      }
    });

    res.json({
      success: true,
      downloadId,
      message: 'Download started'
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Download failed',
      details: error.message
    });
  }
});

// GET /api/download/list
downloadRouter.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(downloadsDir);
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(downloadsDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      })
    );
    res.json(fileList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// DELETE /api/download/:filename
downloadRouter.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(downloadsDir, filename);

    if (!filePath.startsWith(downloadsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    await fs.remove(filePath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Mount the router
app.use('/api/download', downloadRouter);

server.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});
