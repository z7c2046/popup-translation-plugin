/**
 * Popup Translation - 本地原生离线语音服务 (Sherpa-ONNX / Kokoro-82M + MeloTTS 双引擎)
 * 采用原生 C++ 推理库 sherpa-onnx，与 NextAI Translator 相同内核架构
 * 英文：Kokoro-82M 离线神经网络语音 (11 种自然男女声)
 * 中文/双语：MeloTTS (MyShell 开源自然变调高保真语音)
 * 智能分流：英文自动走 Kokoro，中文/混合文本自动走 MeloTTS
 * 零浏览器内存占用 · 毫秒级原生 CPU 推理 · 支持后台无窗口静默运行
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const PORT = process.env.PORT || 18080;
const HOST = '127.0.0.1';

const MODELS_DIR = path.join(__dirname, 'models');
const KOKORO_DIR = path.join(MODELS_DIR, 'kokoro-en-v0_19');
const MELO_DIR = path.join(MODELS_DIR, 'vits-melo-tts-zh_en');

// Kokoro 英文音色映射
const KOKORO_VOICES = {
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

// 1. 确保 sherpa-onnx-node 原生预编译模块存在
function ensureSherpaOnnx() {
  try {
    return require('sherpa-onnx-node');
  } catch (err) {
    console.log('\n[Local TTS] 正在安装 sherpa-onnx-node 原生依赖 (预编译 C++ 动态库)...');
    try {
      execSync('npm install --no-audit sherpa-onnx-node unbzip2-stream tar', {
        cwd: __dirname,
        stdio: 'inherit'
      });
      return require('sherpa-onnx-node');
    } catch (installErr) {
      console.error('[Local TTS] 安装依赖失败，请在 scripts/local-tts-service 目录手动执行: npm install');
      throw installErr;
    }
  }
}

// 2. 工具：以流式进度下载并解压大文件
function downloadAndExtract(urls, targetDir, archiveName) {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }

    const archivePath = path.join(MODELS_DIR, archiveName);

    // 优先尝试 curl.exe 下载
    let downloaded = false;
    for (const urlStr of urls) {
      try {
        console.log(`[Local TTS] 正在尝试下载模型: ${urlStr}`);
        const curlCheck = spawnSync('curl.exe', ['--version'], { stdio: 'ignore' });
        if (curlCheck.status === 0) {
          console.log('[Local TTS] 调用系统 curl.exe 下载中...');
          const curlRes = spawnSync('curl.exe', ['-L', '--fail', '--progress-bar', '-o', archivePath, urlStr], { stdio: 'inherit' });
          if (curlRes.status === 0 && fs.existsSync(archivePath) && fs.statSync(archivePath).size > 1000000) {
            downloaded = true;
            break;
          }
        }
      } catch (e) {}

      // Node.js 原生下载兜底
      try {
        await new Promise((resDl, rejDl) => {
          const file = fs.createWriteStream(archivePath);
          function get(u) {
            const client = u.startsWith('https') ? https : http;
            client.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 LocalTTSService' } }, (res) => {
              if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                return get(new URL(res.headers.location, u).href);
              }
              if (res.statusCode !== 200) {
                file.close();
                fs.unlink(archivePath, () => {});
                return rejDl(new Error(`HTTP ${res.statusCode}`));
              }
              res.pipe(file);
              file.on('finish', () => file.close(resDl));
            }).on('error', (err) => {
              file.close();
              fs.unlink(archivePath, () => {});
              rejDl(err);
            });
          }
          get(urlStr);
        });
        if (fs.existsSync(archivePath) && fs.statSync(archivePath).size > 1000000) {
          downloaded = true;
          break;
        }
      } catch (err) {
        console.warn(`[Local TTS] 下载源异常: ${err.message}，尝试下一源...`);
      }
    }

    if (!downloaded || !fs.existsSync(archivePath)) {
      return reject(new Error(`下载模型包 ${archiveName} 失败`));
    }

    console.log(`[Local TTS] 正在使用纯 Node 流式解压 ${archiveName}...`);
    try {
      const bz2 = require('unbzip2-stream');
      const tar = require('tar');
      fs.createReadStream(archivePath)
        .pipe(bz2())
        .pipe(tar.x({ C: MODELS_DIR }))
        .on('finish', () => {
          console.log(`[Local TTS] ${archiveName} 解压完成！正在清理临时文件...`);
          try { fs.unlinkSync(archivePath); } catch (e) {}
          resolve();
        })
        .on('error', (unzipErr) => {
          console.warn('[Local TTS] 流式解压异常，尝试调用系统 tar 命令...', unzipErr.message);
          const tarRes = spawnSync('tar', ['-xf', archivePath, '-C', MODELS_DIR], { stdio: 'inherit' });
          try { fs.unlinkSync(archivePath); } catch (e) {}
          if (tarRes.status === 0) resolve();
          else reject(unzipErr);
        });
    } catch (e) {
      reject(e);
    }
  });
}

// 3. 校验并就绪 Kokoro 英文模型
async function ensureKokoro() {
  const modelOnnx = path.join(KOKORO_DIR, 'model.onnx');
  const voicesBin = path.join(KOKORO_DIR, 'voices.bin');
  const tokensTxt = path.join(KOKORO_DIR, 'tokens.txt');
  const lexiconTxt = path.join(KOKORO_DIR, 'lexicon-en-us.txt');

  if (!fs.existsSync(modelOnnx) || !fs.existsSync(voicesBin) || !fs.existsSync(tokensTxt)) {
    console.log('\n[Local TTS] 正在获取 Kokoro-82M 英文离线模型...');
    await downloadAndExtract([
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2',
      'https://ghproxy.net/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2'
    ], KOKORO_DIR, 'kokoro-en-v0_19.tar.bz2');
  }

  // 确保发音词典 lexicon-en-us.txt
  if (!fs.existsSync(lexiconTxt)) {
    console.log('[Local TTS] 正在获取 Kokoro 英文发音词典 (lexicon-en-us.txt)...');
    const urls = [
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/lexicon-en-us.txt',
      'https://ghproxy.net/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/lexicon-en-us.txt'
    ];
    for (const u of urls) {
      try {
        const curlRes = spawnSync('curl.exe', ['-L', '--fail', '-o', lexiconTxt, u], { stdio: 'ignore' });
        if (curlRes.status === 0 && fs.existsSync(lexiconTxt) && fs.statSync(lexiconTxt).size > 1000000) break;
      } catch (e) {}
    }
  }

  return KOKORO_DIR;
}

// 4. 校验并就绪 MeloTTS 中英文模型
async function ensureMelo() {
  const modelOnnx = path.join(MELO_DIR, 'model.onnx');
  const lexiconTxt = path.join(MELO_DIR, 'lexicon.txt');
  const tokensTxt = path.join(MELO_DIR, 'tokens.txt');
  const dictDir = path.join(MELO_DIR, 'dict');

  if (!fs.existsSync(modelOnnx) || !fs.existsSync(lexiconTxt) || !fs.existsSync(tokensTxt) || !fs.existsSync(dictDir)) {
    console.log('\n[Local TTS] 正在获取 MeloTTS 中英双语离线模型...');
    await downloadAndExtract([
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2',
      'https://ghproxy.net/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2'
    ], MELO_DIR, 'vits-melo-tts-zh_en.tar.bz2');
  }

  return MELO_DIR;
}

// 判断文本是否包含中文汉字
function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

// 将 Float32Array PCM 音频帧转为 16-bit PCM WAV 二进制 Buffer
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
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

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

  // 就绪模型
  let kokoroEngine = null;
  let meloEngine = null;

  try {
    const kokoroPath = await ensureKokoro();
    console.log('[Local TTS] 正在初始化 Kokoro-82M 英文离线引擎...');
    kokoroEngine = new sherpa_onnx.OfflineTts({
      model: {
        kokoro: {
          model: path.join(kokoroPath, 'model.onnx'),
          voices: path.join(kokoroPath, 'voices.bin'),
          tokens: path.join(kokoroPath, 'tokens.txt'),
          lexicon: path.join(kokoroPath, 'lexicon-en-us.txt')
        },
        numThreads: Math.max(2, Math.min(4, Math.floor(require('os').cpus().length / 2))),
        provider: 'cpu',
        debug: false
      },
      maxNumSentences: 1
    });
    console.log(`[Local TTS] Kokoro 英文引擎已就绪 (11 种发音人, 采样率: ${kokoroEngine.sampleRate}Hz)`);
  } catch (err) {
    console.warn('[Local TTS] Kokoro 引擎初始化警告:', err.message);
  }

  try {
    const meloPath = await ensureMelo();
    console.log('[Local TTS] 正在初始化 MeloTTS 中英双语离线引擎...');
    meloEngine = new sherpa_onnx.OfflineTts({
      model: {
        vits: {
          model: path.join(meloPath, 'model.onnx'),
          lexicon: path.join(meloPath, 'lexicon.txt'),
          tokens: path.join(meloPath, 'tokens.txt'),
          dictDir: path.join(meloPath, 'dict')
        },
        numThreads: Math.max(2, Math.min(4, Math.floor(require('os').cpus().length / 2))),
        provider: 'cpu',
        debug: false
      },
      maxNumSentences: 1
    });
    console.log(`[Local TTS] MeloTTS 中文引擎已就绪 (高保真采样率: ${meloEngine.sampleRate}Hz)`);
  } catch (err) {
    console.warn('[Local TTS] MeloTTS 引擎初始化警告:', err.message);
  }

  if (!kokoroEngine && !meloEngine) {
    throw new Error('未能成功初始化任何 TTS 发音引擎！');
  }

  const server = http.createServer((req, res) => {
    // 跨域支持 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = parsedUrl.pathname;

    // 1. 健康状态接口：GET /health
    if (pathname === '/health' || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'ok',
        engine: 'sherpa-onnx',
        version: sherpa_onnx.version,
        features: {
          kokoro: kokoroEngine ? { ready: true, model: 'kokoro-en-v0_19', sampleRate: kokoroEngine.sampleRate, speakers: 11 } : { ready: false },
          melo: meloEngine ? { ready: true, model: 'vits-melo-tts-zh_en', sampleRate: meloEngine.sampleRate } : { ready: false },
          autoLanguageRouting: true
        },
        kokoroVoices: Object.keys(KOKORO_VOICES).filter(v => v.startsWith('af_') || v.startsWith('am_') || v.startsWith('bf_') || v.startsWith('bm_')),
        message: '本地原生发音服务运行中 · Kokoro + MeloTTS 双引擎就绪 · 零浏览器内存占用'
      }, null, 2));
      return;
    }

    // 2. 发音生成接口：GET /tts?text=...&voice=...&speed=...&model=...
    if (pathname === '/tts' && req.method === 'GET') {
      const text = (parsedUrl.searchParams.get('text') || '').trim();
      const voice = (parsedUrl.searchParams.get('voice') || 'af_heart').trim().toLowerCase();
      const speed = parseFloat(parsedUrl.searchParams.get('speed')) || 1.0;
      const forceModel = (parsedUrl.searchParams.get('model') || 'auto').trim().toLowerCase();

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Text parameter is required' }));
        return;
      }

      // 语种智能路由：包含中文汉字优先使用 MeloTTS；纯英文优先使用 Kokoro
      let useMelo = false;
      if (forceModel === 'melo') {
        useMelo = Boolean(meloEngine);
      } else if (forceModel === 'kokoro') {
        useMelo = false;
      } else {
        // auto 模式
        useMelo = hasChinese(text) && Boolean(meloEngine);
      }

      const activeEngine = useMelo ? meloEngine : (kokoroEngine || meloEngine);
      const engineName = useMelo ? 'MeloTTS (中英双语)' : 'Kokoro-82M (超拟真人声)';

      let sid = 0;
      if (!useMelo && typeof KOKORO_VOICES[voice] === 'number') {
        sid = KOKORO_VOICES[voice];
      }

      try {
        const startTime = Date.now();
        const audio = activeEngine.generate({
          text,
          sid,
          speed: Math.max(0.5, Math.min(2.0, speed))
        });
        const costMs = Date.now() - startTime;
        console.log(`[TTS 合成] [${engineName}] "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}" | 耗时: ${costMs}ms`);

        const wavBuffer = pcmToWavBuffer(audio.samples, audio.sampleRate);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': wavBuffer.length,
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(wavBuffer);
      } catch (genErr) {
        console.error('[Local TTS] 语音合成异常:', genErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: genErr.message || String(genErr) }));
      }
      return;
    }

    // 3. OpenAI 兼容接口：POST /v1/audio/speech
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

          const useMelo = hasChinese(text) && Boolean(meloEngine);
          const activeEngine = useMelo ? meloEngine : (kokoroEngine || meloEngine);
          const sid = !useMelo && typeof KOKORO_VOICES[voice] === 'number' ? KOKORO_VOICES[voice] : 0;

          const audio = activeEngine.generate({ text, sid, speed });
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
    console.log(`🚀 本地原生离线语音服务已就绪！`);
    console.log(`📍 监听地址: http://${HOST}:${PORT}`);
    console.log(`🎙️ 英文引擎: Kokoro-82M (11 种男女音色 · 拟真度断层领先)`);
    console.log(`🇨🇳 中文引擎: MeloTTS (自然连续变调 · 44.1kHz 高保真)`);
    console.log(`🔀 智能分流: 英文自动切 Kokoro，中文自动切 MeloTTS`);
    console.log(`⚡ 性能特点: 纯 CPU AVX2 推理 · 浏览器内存 0 占用 · 毫秒级极速朗读`);
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
