using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace CopyToLLM;

public class PayloadDelivery
{
    public static void Deliver(ElementData data)
    {
        string prompt = "Please analyze this image. If it contains code, identify and fix any errors or explain what it does. Otherwise, explain the contents in a short, concise way.";
        
        // Put the original, clean image on the clipboard
        Thread staImg = new Thread(() =>
        {
            Clipboard.SetImage(data.Image);
        });
        staImg.SetApartmentState(ApartmentState.STA);
        staImg.Start();
        staImg.Join();

        System.Media.SystemSounds.Exclamation.Play();

        string targetUrl = null;

        // Show the menu on a dedicated UI thread to avoid invisible parent issues
        Thread menuThread = new Thread(() =>
        {
            using (var menu = new ProviderMenuForm())
            {
                Application.Run(menu);
                targetUrl = menu.SelectedUrl;
            }
        });
        menuThread.SetApartmentState(ApartmentState.STA);
        menuThread.Start();
        menuThread.Join();

        if (string.IsNullOrEmpty(targetUrl))
            return; // User cancelled

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "chrome.exe",
                Arguments = targetUrl,
                UseShellExecute = true
            });
        }
        catch
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = targetUrl,
                UseShellExecute = true
            });
        }

        Thread.Sleep(4000);
        
        // 1. Paste Image
        SendKeys.SendWait("^v");
        Thread.Sleep(1000); // Wait for the image to attach in the browser UI

        // 2. Put text on clipboard
        Thread staText = new Thread(() =>
        {
            Clipboard.SetText(prompt);
        });
        staText.SetApartmentState(ApartmentState.STA);
        staText.Start();
        staText.Join();

        // 3. Paste Text
        SendKeys.SendWait("^v");
    }
}

public class ProviderMenuForm : Form
{
    public string SelectedUrl { get; private set; }

    public ProviderMenuForm()
    {
        this.FormBorderStyle = FormBorderStyle.None;
        this.StartPosition = FormStartPosition.Manual;
        this.Location = Cursor.Position;
        this.Size = new Size(150, 100);
        this.TopMost = true;
        this.ShowInTaskbar = false;
        this.BackColor = Color.FromArgb(45, 45, 48); // Dark theme

        var layout = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            Margin = new Padding(0)
        };
        
        layout.Controls.Add(CreateButton("🧠 ChatGPT", "https://chatgpt.com/"));
        layout.Controls.Add(CreateButton("🎨 Claude", "https://claude.ai/new"));
        layout.Controls.Add(CreateButton("✨ Gemini", "https://gemini.google.com/"));

        this.Controls.Add(layout);
    }

    private Button CreateButton(string text, string url)
    {
        var btn = new Button
        {
            Text = text,
            Width = 150,
            Height = 33,
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.White,
            BackColor = Color.FromArgb(45, 45, 48),
            TextAlign = ContentAlignment.MiddleLeft,
            Margin = new Padding(0),
            Cursor = Cursors.Hand
        };
        btn.FlatAppearance.BorderSize = 0;
        
        // Hover effects
        btn.MouseEnter += (s, e) => btn.BackColor = Color.FromArgb(60, 60, 65);
        btn.MouseLeave += (s, e) => btn.BackColor = Color.FromArgb(45, 45, 48);

        btn.Click += (s, e) =>
        {
            SelectedUrl = url;
            this.DialogResult = DialogResult.OK;
            this.Close();
        };
        return btn;
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        this.Activate();
    }

    private bool _hasActivated = false;

    protected override void OnActivated(EventArgs e)
    {
        base.OnActivated(e);
        _hasActivated = true;
    }

    protected override void OnDeactivate(EventArgs e)
    {
        base.OnDeactivate(e);
        if (_hasActivated)
        {
            this.Close(); // Close if user clicks outside
        }
    }
}
