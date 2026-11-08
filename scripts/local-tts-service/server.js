/**
 * LexiPro - 本地原生离线发音伴侣服务 (Sherpa-ONNX / Kokoro-82M)
 * 采用原生 C++ 推理库 sherpa-onnx，与 NextAI Translator 相同内核
 * 零浏览器内存开销 · 毫秒级极速响应 · 原生 CPU AVX2 指令集加速
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync, spawnSync } = require('child_process');

const PORT = process.env.PORT || 18080;
const HOST = '127.0.0.1';
const MODEL_NAME = 'kokoro-en-v0_19';
const MODELS_DIR = path.join(__dirname, 'models');
const MODEL_TARGET_DIR = path.join(MODELS_DIR, MODEL_NAME);

// 声音映射表 (Kokoro-82M 英文发音人)
const VOICE_MAP = {
  'af_heart': 0,
  'heart': 0,
  'af_bella': 1,
  'bella': 1,
  'af_nicole': 2,
  'nicole': 2,
  'af_aoede': 3,
  'aoede': 3,
  'af_kore': 4,
  'kore': 4,
  'af_sarah': 5,
  'sarah': 5,
  'am_adam': 6,
  'adam': 6,
  'am_michael': 7,
  'michael': 7,
  'bf_emma': 8,
  'emma': 8,
  'bf_isabella': 9,
  'isabella': 9,
  'bf_alice': 8, // 英音女声回退
  'alice': 8,
  'bm_george': 10,
  'george': 10,
  'bm_lewis': 11,
  'lewis': 11
};

// 1. 确保 sherpa-onnx-node 原生依赖存在
function ensureSherpaOnnx() {
  try {
    return require('sherpa-onnx-node');
  } catch (err) {
    console.log('\n[Local TTS] 检测到未安装 sherpa-onnx-node，正在自动安装原生预编译依赖 (无需编译环境)...');
    try {
      execSync('npm install --no-audit sherpa-onnx-node', {
        cwd: __dirname,
        stdio: 'inherit'
      });
      return require('sherpa-onnx-node');
    } catch (installErr) {
      console.error('[Local TTS] 自动安装依赖失败，请在当前目录手动执行: npm install');
      throw installErr;
    }
  }
}

// 2. 工具：以流式进度下载大文件
function downloadFile(sourceUrl, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastPercent = -1;

    function request(currentUrl) {
      const client = currentUrl.startsWith('https') ? https : http;
      client.get(currentUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LexiProLocalTTS/1.0' }
      }, (res) => {
        // 重定向处理 (301, 302, 307, 308)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          return request(res.headers.location);
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`下载失败，HTTP 状态码: ${res.statusCode}`));
        }

        totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        res.pipe(file);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((downloadedBytes / totalBytes) * 100);
            if (percent !== lastPercent && percent % 5 === 0) {
              lastPercent = percent;
              const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(1);
              const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
              process.stdout.write(`\r[Local TTS] 正在下载语音模型: ${percent}% (${mbDownloaded}MB / ${mbTotal}MB)...`);
            }
          }
        });

        file.on('finish', () => {
          file.close(() => {
            process.stdout.write('\n');
            resolve();
          });
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    request(sourceUrl);
  });
}

// 3. 确保本地模型文件存在
async function ensureModel() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const modelOnnxPath = path.join(MODEL_TARGET_DIR, 'model.onnx');
  const voicesBinPath = path.join(MODEL_TARGET_DIR, 'voices.bin');
  const tokensTxtPath = path.join(MODEL_TARGET_DIR, 'tokens.txt');

  if (fs.existsSync(modelOnnxPath) && fs.existsSync(voicesBinPath) && fs.existsSync(tokensTxtPath)) {
    return MODEL_TARGET_DIR;
  }

  console.log(`\n============================================================`);
  console.log(`[Local TTS] 首次运行：未检测到 Kokoro 离线模型，即将下载至本地硬盘...`);
  console.log(`[Local TTS] 模型目标路径: ${MODEL_TARGET_DIR}`);
  console.log(`============================================================\n`);

  const archivePath = path.join(MODELS_DIR, `${MODEL_NAME}.tar.bz2`);
  const downloadUrls = [
    `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${MODEL_NAME}.tar.bz2`,
    `https://ghproxy.net/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${MODEL_NAME}.tar.bz2`
  ];

  let downloaded = false;
  for (const urlStr of downloadUrls) {
    try {
      console.log(`[Local TTS] 尝试从地址下载: ${urlStr}`);
      await downloadFile(urlStr, archivePath);
      downloaded = true;
      break;
    } catch (e) {
      console.warn(`[Local TTS] 下载镜像异常 (${e.message})，尝试备用源...`);
    }
  }

  if (!downloaded || !fs.existsSync(archivePath)) {
    throw new Error('下载模型失败，请检查网络连接或手动将 kokoro-en-v0_19 放入 models/ 目录');
  }

  console.log('[Local TTS] 下载完成，正在使用系统内置 tar 解压模型...');
  try {
    const tarResult = spawnSync('tar', ['-xf', archivePath, '-C', MODELS_DIR], { stdio: 'inherit' });
    if (tarResult.status !== 0) {
      throw new Error(`tar 解压退出码: ${tarResult.status}`);
    }
    console.log('[Local TTS] 解压成功！正在清理临时压缩包...');
    try { fs.unlinkSync(archivePath); } catch (e) {}
  } catch (unzipErr) {
    console.error('[Local TTS] 解压异常:', unzipErr.message);
    throw unzipErr;
  }

  return MODEL_TARGET_DIR;
}

// 4. 将 Float32Array PCM 音频帧转为标准 16-bit PCM WAV 二进制 Buffer
function pcmToWavBuffer(samples, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Subchunk 1: fmt
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16-bit)

  // Subchunk 2: data
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(val), offset);
    offset += 2;
  }

  return buffer;
}

// 5. 启动服务主流程
async function startServer() {
  const sherpa_onnx = ensureSherpaOnnx();
  const modelDir = await ensureModel();

  console.log('\n[Local TTS] 正在初始化原生 C++ Sherpa-ONNX Kokoro-82M 引擎...');
  const tts = new sherpa_onnx.OfflineTts({
    model: {
      kokoro: {
        model: path.join(modelDir, 'model.onnx'),
        voices: path.join(modelDir, 'voices.bin'),
        tokens: path.join(modelDir, 'tokens.txt'),
        dataDir: path.join(modelDir, 'espeak-ng-data')
      },
      numThreads: Math.max(2, Math.min(4, Math.floor(require('os').cpus().length / 2))),
      provider: 'cpu',
      debug: false
    },
    maxNumSentences: 1
  });

  console.log(`[Local TTS] 引擎初始化完成！(发音人数量: ${tts.numSpeakers}, 采样率: ${tts.sampleRate}Hz)`);

  const server = http.createServer((req, res) => {
    // 允许任何网页及扩展跨域请求 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 健康检查接口
    if (pathname === '/health' || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'ok',
        engine: 'sherpa-onnx',
        model: MODEL_NAME,
        version: sherpa_onnx.version,
        sampleRate: tts.sampleRate,
        numSpeakers: tts.numSpeakers,
        voices: Object.keys(VOICE_MAP).filter(v => v.startsWith('af_') || v.startsWith('am_') || v.startsWith('bf_') || v.startsWith('bm_')),
        message: 'LexiPro 本地原生发音服务运行中 · 零浏览器内存占用'
      }, null, 2));
      return;
    }

    // TTS 发音接口：GET /tts?text=...&voice=...&speed=...
    if (pathname === '/tts' && req.method === 'GET') {
      const text = (parsedUrl.query.text || '').trim();
      const voice = (parsedUrl.query.voice || 'af_heart').trim().toLowerCase();
      const speed = parseFloat(parsedUrl.query.speed) || 1.0;

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Text parameter is required' }));
        return;
      }

      let sid = 0;
      if (typeof VOICE_MAP[voice] === 'number') {
        sid = VOICE_MAP[voice];
      } else if (!isNaN(parseInt(voice, 10))) {
        sid = parseInt(voice, 10);
      }

      try {
        const startTime = Date.now();
        const audio = tts.generate({
          text,
          sid,
          speed: Math.max(0.5, Math.min(2.0, speed))
        });

        const costMs = Date.now() - startTime;
        console.log(`[TTS 合成] "${text.slice(0, 35)}${text.length > 35 ? '...' : ''}" | 音色: ${voice} (sid: ${sid}) | 耗时: ${costMs}ms`);

        const wavBuffer = pcmToWavBuffer(audio.samples, audio.sampleRate);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': wavBuffer.length,
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(wavBuffer);
      } catch (genErr) {
        console.error('[Local TTS] 生成语音异常:', genErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: genErr.message || String(genErr) }));
      }
      return;
    }

    // OpenAI 兼容格式接口：POST /v1/audio/speech
    if (pathname === '/v1/audio/speech' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const text = (payload.input || '').trim();
          const voice = (payload.voice || 'af_heart').trim().toLowerCase();
          const speed = parseFloat(payload.speed) || 1.0;

          if (!text) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'input is required' }));
            return;
          }

          const sid = typeof VOICE_MAP[voice] === 'number' ? VOICE_MAP[voice] : 0;
          const audio = tts.generate({ text, sid, speed });
          const wavBuffer = pcmToWavBuffer(audio.samples, audio.sampleRate);

          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': wavBuffer.length
          });
          res.end(wavBuffer);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message || 'Invalid JSON' }));
        }
      });
      return;
    }

    // 默认 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, HOST, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 LexiPro 本地原生伴侣发音服务已就绪！`);
    console.log(`📍 监听地址: http://${HOST}:${PORT}`);
    console.log(`⚡ 特点: 原生 C++ CPU 推理 · 零浏览器显存占用 · 毫秒级极速朗读`);
    console.log(`💡 测试地址: http://${HOST}:${PORT}/health`);
    console.log(`============================================================\n`);
  });
}

// 捕获未捕获异常
process.on('uncaughtException', (err) => {
  console.error('[Local TTS] 进程异常:', err);
});

startServer().catch((err) => {
  console.error('[Local TTS] 启动服务失败:', err);
  process.exit(1);
});
