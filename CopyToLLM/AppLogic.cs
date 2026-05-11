using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;

namespace CopyToLLM;

public static class HotkeyManager
{
    public const int WM_HOTKEY = 0x0312;

    [Flags]
    public enum KeyModifiers
    {
        None = 0,
        Alt = 1,
        Control = 2,
        Shift = 4,
        Windows = 8
    }

    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vlc);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}

public class HiddenContext : ApplicationContext
{
    private HiddenForm _form;

    public HiddenContext()
    {
        _form = new HiddenForm();
    }
}

public class HiddenForm : Form
{
    private const int HOTKEY_ID = 9000;

    public HiddenForm()
    {
        this.WindowState = FormWindowState.Minimized;
        this.ShowInTaskbar = false;
        
        // Ctrl + Shift + S
        bool registered = HotkeyManager.RegisterHotKey(this.Handle, HOTKEY_ID, (int)(HotkeyManager.KeyModifiers.Control | HotkeyManager.KeyModifiers.Shift), (int)Keys.S);
        if (!registered)
        {
            MessageBox.Show("Failed to register the Ctrl+Shift+S hotkey. It is likely already in use by another application.", "CopyToLLM Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Environment.Exit(1);
        }
    }

    protected override void SetVisibleCore(bool value)
    {
        base.SetVisibleCore(false);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == HotkeyManager.WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID)
        {
            Task.Run(() => AppLogic.ProcessHotkey());
        }
        base.WndProc(ref m);
    }

    protected override void Dispose(bool disposing)
    {
        HotkeyManager.UnregisterHotKey(this.Handle, HOTKEY_ID);
        base.Dispose(disposing);
    }
}

public static class AppLogic
{
    private static bool _isProcessing = false;

    public static void ProcessHotkey()
    {
        System.Media.SystemSounds.Beep.Play();
        
        if (_isProcessing) return;
        _isProcessing = true;

        try
        {
            CaptureMode mode = CaptureMode.None;
            Rectangle region = Rectangle.Empty;
            Point clickPoint = Point.Empty;

            Thread overlayThread = new Thread(() =>
            {
                using (var overlay = new SnippingOverlayForm())
                {
                    Application.Run(overlay);
                    mode = overlay.Mode;
                    region = overlay.SelectedRegion;
                    clickPoint = overlay.ClickPoint;
                }
            });
            overlayThread.SetApartmentState(ApartmentState.STA);
            overlayThread.Start();
            overlayThread.Join();

            if (mode != CaptureMode.None)
            {
                var data = UIElementCapture.Capture(mode, region, clickPoint);
                if (data != null)
                {
                    PayloadDelivery.Deliver(data);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.ToString());
        }
        finally
        {
            _isProcessing = false;
        }
    }
}
