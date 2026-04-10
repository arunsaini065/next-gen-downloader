const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
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
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

// Ensure downloads directory exists
fs.ensureDirSync(downloadsDir);

function buildInfoArgs(url) {
  const args = [
    url,
    '--dump-single-json',
    '--no-warnings',
    '--no-check-certificates',
    '--user-agent', DEFAULT_USER_AGENT,
    '--add-header', 'accept-language:en-US,en;q=0.9'
  ];

  try {
    const { hostname } = new URL(url);
    if (hostname.includes('instagram.com')) {
      args.push('--add-header', 'referer:https://www.instagram.com/');
      args.push('--extractor-args', 'instagram:api_version=v1;dailymotion:impersonate=false');
    }
  } catch (error) {
    // URL validation happens before this helper is called.
  }

  return args;
}

function isManifestFormat(format = {}) {
  const formatId = String(format.format_id || '').toLowerCase();
  const ext = String(format.ext || '').toLowerCase();
  const protocol = String(format.protocol || '').toLowerCase();

  return (
    formatId.startsWith('hls') ||
    formatId.startsWith('dash') ||
    ext === 'm3u8' ||
    ext === 'mpd' ||
    protocol.includes('m3u8') ||
    protocol.includes('dash') ||
    protocol.includes('http_dash_segments')
  );
}

function hasVideo(format = {}) {
  if (typeof format.vcodec === 'string') {
    return format.vcodec !== 'none';
  }

  return Boolean(format.video_ext && format.video_ext !== 'none');
}

function hasAudio(format = {}) {
  if (typeof format.acodec === 'string') {
    return format.acodec !== 'none';
  }

  return Boolean(format.audio_ext && format.audio_ext !== 'none');
}

function getFormatHeight(format = {}) {
  const numericHeight = Number(format.height);
  if (Number.isFinite(numericHeight)) {
    return numericHeight;
  }

  const resolution = String(format.resolution || '');
  const match = resolution.match(/(\d+)x(\d+)/);
  return match ? Number(match[2]) : 0;
}

function normalizeFormat(format = {}) {
  return {
    format_id: format.format_id,
    ext: format.ext || null,
    quality: format.format_note || format.format || null,
    resolution: format.resolution || (
      format.width && format.height ? `${format.width}x${format.height}` : null
    ),
    width: format.width || null,
    height: format.height || null,
    protocol: format.protocol || null,
    hasVideo: hasVideo(format),
    hasAudio: hasAudio(format),
    isDirect: !isManifestFormat(format),
    url: format.url || null
  };
}

function chooseBestVideo(formats = []) {
  const candidates = formats.filter((format) => (
    format.url &&
    hasVideo(format)
  ));

  candidates.sort((left, right) => {
    const leftDirect = Number(!isManifestFormat(left));
    const rightDirect = Number(!isManifestFormat(right));
    if (leftDirect !== rightDirect) return rightDirect - leftDirect;

    const leftMuxed = Number(hasAudio(left));
    const rightMuxed = Number(hasAudio(right));
    if (leftMuxed !== rightMuxed) return rightMuxed - leftMuxed;

    const leftMp4 = Number(String(left.ext || '').toLowerCase() === 'mp4');
    const rightMp4 = Number(String(right.ext || '').toLowerCase() === 'mp4');
    if (leftMp4 !== rightMp4) return rightMp4 - leftMp4;

    const leftHeight = getFormatHeight(left);
    const rightHeight = getFormatHeight(right);
    if (leftHeight !== rightHeight) return rightHeight - leftHeight;

    return (right.tbr || 0) - (left.tbr || 0);
  });

  return candidates[0] || null;
}

function classifyInfoError(stderr = '') {
  const message = stderr.toLowerCase();

  if (message.includes('drm')) {
    return {
      status: 422,
      code: 'DRM_PROTECTED',
      error: 'This content is DRM-protected and cannot be resolved.'
    };
  }

  if (
    message.includes('private video') ||
    message.includes('private') ||
    message.includes('login required') ||
    message.includes('sign in') ||
    message.includes('members only') ||
    message.includes('password')
  ) {
    return {
      status: 422,
      code: 'LOGIN_OR_PRIVATE',
      error: 'This content is private or requires login.'
    };
  }

  if (
    message.includes('geo') ||
    message.includes('not available in your country') ||
    message.includes('blocked in your country')
  ) {
    return {
      status: 422,
      code: 'GEO_BLOCKED',
      error: 'This content is geo-blocked.'
    };
  }

  return {
    status: 500,
    code: 'INFO_FETCH_FAILED',
    error: 'Failed to fetch media info.'
  };
}

// Home route
app.get("/", (req, res) => {
    res.send("YT-DLP API Running 🚀");
});

// GET /info - Fetch video information (keeping from previous version)
app.get("/info", (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL required" });

    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(url)) {
      return res.status(400).json({ error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.' });
    }

    const args = buildInfoArgs(url);
    const ytdlp = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        const errorResponse = classifyInfoError(stderr);
        return res.status(errorResponse.status).json({
          error: errorResponse.error,
          code: errorResponse.code,
          details: stderr.trim() || null
        });
      }

      try {
        const data = JSON.parse(stdout);
        const formats = Array.isArray(data.formats) ? data.formats : [];
        const bestVideo = chooseBestVideo(formats);
        const normalizedFormats = formats
          .filter((format) => format.url && (hasVideo(format) || hasAudio(format)))
          .map(normalizeFormat);

        res.json({
          title: data.title || null,
          thumbnail: data.thumbnail || null,
          duration: data.duration || null,
          extractor: data.extractor || null,
          webpage_url: data.webpage_url || url,
          bestVideoUrl: bestVideo?.url || null,
          bestVideoFormatId: bestVideo?.format_id || null,
          formats: normalizedFormats
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to parse info',
          code: 'INFO_PARSE_FAILED'
        });
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
    args.push('--user-agent', DEFAULT_USER_AGENT);
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
