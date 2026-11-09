using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Media;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace LexiProTTS
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isNewInstance;
            using (Mutex mutex = new Mutex(true, "LexiPro_TTS_Companion_SingleInstance_Mutex_2026", out isNewInstance))
            {
                if (!isNewInstance)
                {
                    MessageBox.Show(
                        "LexiPro 本地原生发音伴侣已在运行中！\n\n请查看屏幕右下角任务栏通知区域（托盘小箭头）中的小喇叭图标。",
                        "LexiPro TTS 已在运行",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return;
                }

                Application.Run(new TrayApplicationContext());
            }
        }
    }

    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private Process nodeProcess;
        private MainForm mainForm;
        private ToolStripMenuItem statusMenuItem;
        private ToolStripMenuItem autoStartMenuItem;

        private const string REG_RUN_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string APP_NAME = "LexiPro_TTS_Service";
        private const int SERVICE_PORT = 18080;

        public TrayApplicationContext()
        {
            KillExistingPortProcesses(SERVICE_PORT);
            StartBackendService();

            InitializeTray();

            mainForm = new MainForm(this);

            // 首次启动时提示用户已进入托盘
            trayIcon.ShowBalloonTip(
                2000,
                "LexiPro 本地发音伴侣已启动",
                "Kokoro-82M + MeloTTS 原生引擎已就绪，已自动收起在任务栏托盘中，浏览器划词随时可用。",
                ToolTipIcon.Info);
        }

        private void InitializeTray()
        {
            Icon appIcon = CreateAppIcon();

            trayMenu = new ContextMenuStrip();

            ToolStripMenuItem titleItem = new ToolStripMenuItem("LexiPro 本地发音伴侣 (Kokoro + MeloTTS)");
            titleItem.Enabled = false;
            titleItem.Font = new Font(titleItem.Font, FontStyle.Bold);
            trayMenu.Items.Add(titleItem);

            statusMenuItem = new ToolStripMenuItem("● 服务状态: 正在检测...");
            statusMenuItem.Enabled = false;
            trayMenu.Items.Add(statusMenuItem);

            trayMenu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem testEnItem = new ToolStripMenuItem("🔊 试听英文 (Kokoro 拟真人声)", null, (s, e) => PlayTestAudio("en"));
            trayMenu.Items.Add(testEnItem);

            ToolStripMenuItem testZhItem = new ToolStripMenuItem("🔊 试听中文 (MeloTTS 变调高保真)", null, (s, e) => PlayTestAudio("zh"));
            trayMenu.Items.Add(testZhItem);

            trayMenu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem openPanelItem = new ToolStripMenuItem("⚙️ 打开控制面板...", null, (s, e) => ShowMainForm());
            openPanelItem.Font = new Font(openPanelItem.Font, FontStyle.Bold);
            trayMenu.Items.Add(openPanelItem);

            autoStartMenuItem = new ToolStripMenuItem("⚡ 开机自动在后台启动", null, ToggleAutoStart);
            autoStartMenuItem.Checked = IsAutoStartEnabled();
            trayMenu.Items.Add(autoStartMenuItem);

            trayMenu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem exitItem = new ToolStripMenuItem("❌ 退出服务", null, (s, e) => ExitApplication());
            trayMenu.Items.Add(exitItem);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "LexiPro 本地原生发音伴侣 (Kokoro + MeloTTS)";
            trayIcon.Icon = appIcon;
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;

            trayIcon.DoubleClick += (s, e) => ShowMainForm();

            // 异步轮询一次健康状态
            ThreadPool.QueueUserWorkItem(CheckHealthAsync);
        }

        public void ShowMainForm()
        {
            if (mainForm == null || mainForm.IsDisposed)
            {
                mainForm = new MainForm(this);
            }
            mainForm.Show();
            mainForm.WindowState = FormWindowState.Normal;
            mainForm.BringToFront();
            mainForm.Activate();
        }

        private void StartBackendService()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string serviceDir = Path.Combine(baseDir, @"scripts\local-tts-service");

            if (!Directory.Exists(serviceDir))
            {
                serviceDir = baseDir; // 容错兼容
            }

            string serverScript = Path.Combine(serviceDir, "server.js");
            if (!File.Exists(serverScript))
            {
                MessageBox.Show("未找到本地服务入口脚本: " + serverScript, "LexiPro TTS 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "node.exe";
                psi.Arguments = "server.js";
                psi.WorkingDirectory = serviceDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                nodeProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("启动 Node.js 原生伴侣服务失败: " + ex.Message + "\n请确认系统已安装 Node.js。", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void KillExistingPortProcesses(int port)
        {
            try
            {
                Process p = new Process();
                p.StartInfo.FileName = "netstat.exe";
                p.StartInfo.Arguments = "-aon";
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                string output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(2000);

                string[] lines = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string line in lines)
                {
                    if (line.Contains(":" + port) && line.Contains("LISTENING"))
                    {
                        string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 5)
                        {
                            int pid;
                            if (int.TryParse(parts[parts.Length - 1], out pid))
                            {
                                try
                                {
                                    Process toKill = Process.GetProcessById(pid);
                                    if (toKill != null && !toKill.HasExited)
                                    {
                                        toKill.Kill();
                                        toKill.WaitForExit(1500);
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
            }
            catch { }
        }

        public void PlayTestAudio(string lang)
        {
            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    string url;
                    if (lang == "zh")
                    {
                        url = string.Format("http://127.0.0.1:{0}/tts?text={1}&speed=1.0",
                            SERVICE_PORT, Uri.EscapeDataString("你好，欢迎使用LexiPro本地发音伴侣，这是MeloTTS中文发音。"));
                    }
                    else
                    {
                        url = string.Format("http://127.0.0.1:{0}/tts?text={1}&voice=af_heart&speed=1.0",
                            SERVICE_PORT, Uri.EscapeDataString("Welcome to LexiPro. Experience native neural speech with Kokoro."));
                    }

                    using (WebClient wc = new WebClient())
                    {
                        byte[] audioBytes = wc.DownloadData(url);
                        using (MemoryStream ms = new MemoryStream(audioBytes))
                        {
                            SoundPlayer player = new SoundPlayer(ms);
                            player.PlaySync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("试听发音失败: " + ex.Message + "\n请确认服务已启动完成。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            });
        }

        private void CheckHealthAsync(object state)
        {
            Thread.Sleep(2500); // 等待服务就绪
            try
            {
                using (WebClient wc = new WebClient())
                {
                    string json = wc.DownloadString(string.Format("http://127.0.0.1:{0}/health", SERVICE_PORT));
                    if (json.Contains("\"status\": \"ok\"") || json.Contains("\"status\":\"ok\""))
                    {
                        if (trayMenu != null && !trayMenu.IsDisposed)
                        {
                            trayMenu.Invoke((MethodInvoker)delegate
                            {
                                statusMenuItem.Text = string.Format("● 服务在线 (Kokoro + MeloTTS 端口: {0})", SERVICE_PORT);
                                statusMenuItem.ForeColor = Color.ForestGreen;
                            });
                        }
                    }
                }
            }
            catch
            {
                if (trayMenu != null && !trayMenu.IsDisposed)
                {
                    trayMenu.Invoke((MethodInvoker)delegate
                    {
                        statusMenuItem.Text = "○ 服务加载中/重试中...";
                    });
                }
            }
        }

        public bool IsAutoStartEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_RUN_KEY, false))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(APP_NAME);
                        return val != null;
                    }
                }
            }
            catch { }
            return false;
        }

        public void SetAutoStart(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_RUN_KEY, true))
                {
                    if (key != null)
                    {
                        if (enable)
                        {
                            string exePath = Application.ExecutablePath;
                            key.SetValue(APP_NAME, "\"" + exePath + "\"");
                        }
                        else
                        {
                            key.DeleteValue(APP_NAME, false);
                        }
                    }
                }
                if (autoStartMenuItem != null)
                {
                    autoStartMenuItem.Checked = enable;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("设置开机自启失败: " + ex.Message, "权限提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void ToggleAutoStart(object sender, EventArgs e)
        {
            bool nextState = !IsAutoStartEnabled();
            SetAutoStart(nextState);
        }

        public void ExitApplication()
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }

            if (nodeProcess != null && !nodeProcess.HasExited)
            {
                try
                {
                    nodeProcess.Kill();
                }
                catch { }
            }

            KillExistingPortProcesses(SERVICE_PORT);
            Application.Exit();
        }

        private Icon CreateAppIcon()
        {
            using (Bitmap bmp = new Bitmap(32, 32))
            {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;

                    // 绘制圆形翡翠绿底色
                    using (Brush bgBrush = new LinearGradientBrush(
                        new Point(0, 0), new Point(32, 32),
                        Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105)))
                    {
                        g.FillEllipse(bgBrush, 1, 1, 30, 30);
                    }

                    // 绘制白色小喇叭图标
                    using (SolidBrush whiteBrush = new SolidBrush(Color.White))
                    {
                        // 喇叭后方矩形
                        g.FillRectangle(whiteBrush, 8, 12, 5, 8);

                        // 喇叭前方梯形
                        Point[] points = new Point[]
                        {
                            new Point(13, 12),
                            new Point(19, 8),
                            new Point(19, 24),
                            new Point(13, 20)
                        };
                        g.FillPolygon(whiteBrush, points);

                        // 声波弧线
                        using (Pen arcPen = new Pen(Color.White, 2f))
                        {
                            g.DrawArc(arcPen, 18, 11, 7, 10, -50, 100);
                            g.DrawArc(arcPen, 19, 8, 10, 16, -50, 100);
                        }
                    }
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }
    }

    public class MainForm : Form
    {
        private TrayApplicationContext appCtx;
        private Label statusLabel;
        private CheckBox autoStartCheck;

        public MainForm(TrayApplicationContext ctx)
        {
            this.appCtx = ctx;
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "LexiPro TTS - 本地原生发音伴侣 (Kokoro + MeloTTS)";
            this.Size = new Size(460, 420);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.BackColor = Color.White;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // 头部卡片
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 70;
            headerPanel.BackColor = Color.FromArgb(240, 253, 244);
            this.Controls.Add(headerPanel);

            Label titleLabel = new Label();
            titleLabel.Text = "🚀 LexiPro 本地原生发音伴侣";
            titleLabel.Font = new Font("Microsoft YaHei", 12.5f, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(22, 101, 52);
            titleLabel.Location = new Point(16, 12);
            titleLabel.AutoSize = true;
            headerPanel.Controls.Add(titleLabel);

            Label subTitleLabel = new Label();
            subTitleLabel.Text = "NextAI 同款 Sherpa-ONNX 原生 C++ 架构 · 零浏览器显存占用";
            subTitleLabel.Font = new Font("Microsoft YaHei", 8.5f, FontStyle.Regular);
            subTitleLabel.ForeColor = Color.FromArgb(21, 128, 61);
            subTitleLabel.Location = new Point(18, 40);
            subTitleLabel.AutoSize = true;
            headerPanel.Controls.Add(subTitleLabel);

            // 内容区域
            GroupBox infoGroup = new GroupBox();
            infoGroup.Text = "服务与引擎状态";
            infoGroup.Font = new Font("Microsoft YaHei", 9f, FontStyle.Bold);
            infoGroup.Location = new Point(16, 85);
            infoGroup.Size = new Size(412, 160);
            this.Controls.Add(infoGroup);

            statusLabel = new Label();
            statusLabel.Text = "● 状态: 服务运行中 (监听端口: 18080)";
            statusLabel.Font = new Font("Microsoft YaHei", 9.5f, FontStyle.Bold);
            statusLabel.ForeColor = Color.ForestGreen;
            statusLabel.Location = new Point(16, 26);
            statusLabel.AutoSize = true;
            infoGroup.Controls.Add(statusLabel);

            Label engineInfo = new Label();
            engineInfo.Text = "🎙️ 英文引擎：Kokoro-82M (11 种男女声 · 极速毫秒级发音)\n" +
                              "🇨🇳 中文引擎：MeloTTS (自然汉字连续变调 · 44.1kHz 高保真)\n" +
                              "🔀 智能分流：英文单词/例句切 Kokoro，中文释义切 MeloTTS\n" +
                              "⚡ 系统开销：纯 CPU AVX2 推理 · 浏览器内存 0 占用";
            engineInfo.Font = new Font("Microsoft YaHei", 8.5f, FontStyle.Regular);
            engineInfo.ForeColor = Color.FromArgb(71, 85, 105);
            engineInfo.Location = new Point(16, 56);
            engineInfo.Size = new Size(380, 95);
            infoGroup.Controls.Add(engineInfo);

            // 试听测试按钮
            Button btnTestEn = new Button();
            btnTestEn.Text = "🔊 试听英文 (Kokoro)";
            btnTestEn.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular);
            btnTestEn.Size = new Size(198, 36);
            btnTestEn.Location = new Point(16, 255);
            btnTestEn.BackColor = Color.FromArgb(248, 250, 252);
            btnTestEn.Click += (s, e) => appCtx.PlayTestAudio("en");
            this.Controls.Add(btnTestEn);

            Button btnTestZh = new Button();
            btnTestZh.Text = "🔊 试听中文 (MeloTTS)";
            btnTestZh.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular);
            btnTestZh.Size = new Size(198, 36);
            btnTestZh.Location = new Point(230, 255);
            btnTestZh.BackColor = Color.FromArgb(248, 250, 252);
            btnTestZh.Click += (s, e) => appCtx.PlayTestAudio("zh");
            this.Controls.Add(btnTestZh);

            // 开机自启动复选框
            autoStartCheck = new CheckBox();
            autoStartCheck.Text = "随 Windows 开机自动在后台常驻 (静默运行，无黑窗口)";
            autoStartCheck.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular);
            autoStartCheck.ForeColor = Color.FromArgb(51, 65, 85);
            autoStartCheck.Location = new Point(18, 302);
            autoStartCheck.Size = new Size(400, 24);
            autoStartCheck.Checked = appCtx.IsAutoStartEnabled();
            autoStartCheck.CheckedChanged += (s, e) => appCtx.SetAutoStart(autoStartCheck.Checked);
            this.Controls.Add(autoStartCheck);

            // 底部操作按钮
            Button btnHide = new Button();
            btnHide.Text = "收起到任务栏托盘";
            btnHide.Font = new Font("Microsoft YaHei", 9f, FontStyle.Bold);
            btnHide.ForeColor = Color.White;
            btnHide.BackColor = Color.FromArgb(16, 185, 129);
            btnHide.FlatStyle = FlatStyle.Flat;
            btnHide.FlatAppearance.BorderSize = 0;
            btnHide.Size = new Size(240, 34);
            btnHide.Location = new Point(16, 336);
            btnHide.Click += (s, e) =>
            {
                this.Hide();
            };
            this.Controls.Add(btnHide);

            Button btnExit = new Button();
            btnExit.Text = "彻底退出";
            btnExit.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular);
            btnExit.ForeColor = Color.FromArgb(100, 116, 139);
            btnExit.BackColor = Color.FromArgb(241, 245, 249);
            btnExit.FlatStyle = FlatStyle.Flat;
            btnExit.FlatAppearance.BorderSize = 0;
            btnExit.Size = new Size(156, 34);
            btnExit.Location = new Point(272, 336);
            btnExit.Click += (s, e) => appCtx.ExitApplication();
            this.Controls.Add(btnExit);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // 用户点击窗口右上角叉号【X】，自动收起到系统托盘，不杀掉后台服务！
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
            }
            else
            {
                base.OnFormClosing(e);
            }
        }
    }
}
