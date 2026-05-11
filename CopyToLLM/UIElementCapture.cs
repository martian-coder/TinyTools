using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Windows.Forms;

namespace CopyToLLM;

public class UIElementCapture
{
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    public static ElementData? Capture(CaptureMode mode, Rectangle region, Point clickPoint)
    {
        Rectangle boundsToCapture;
        System.Windows.Point wpfPoint;

        if (mode == CaptureMode.Region)
        {
            boundsToCapture = region;
            // Get metadata from the center of the drawn box
            wpfPoint = new System.Windows.Point(region.X + region.Width / 2, region.Y + region.Height / 2);
        }
        else if (mode == CaptureMode.FullScreen)
        {
            boundsToCapture = SystemInformation.VirtualScreen;
            // Get metadata from current cursor or center of screen
            if (GetCursorPos(out POINT pt))
                wpfPoint = new System.Windows.Point(pt.X, pt.Y);
            else
                wpfPoint = new System.Windows.Point(boundsToCapture.X + boundsToCapture.Width / 2, boundsToCapture.Y + boundsToCapture.Height / 2);
        }
        else // AutoElement
        {
            wpfPoint = new System.Windows.Point(clickPoint.X, clickPoint.Y);
            boundsToCapture = Rectangle.Empty; // Will be set by element
        }

        AutomationElement? element = null;
        try
        {
            element = AutomationElement.FromPoint(wpfPoint);
        }
        catch { }

        if (mode == CaptureMode.AutoElement || mode == CaptureMode.ScrollCapture)
        {
            if (element == null) return null;
            var r = element.Current.BoundingRectangle;
            if (r.IsEmpty || r.Width <= 0 || r.Height <= 0) return null;
            boundsToCapture = new Rectangle((int)r.Left, (int)r.Top, (int)r.Width, (int)r.Height);
        }

        if (boundsToCapture.Width <= 0 || boundsToCapture.Height <= 0) return null;

        Bitmap? bmp;
        if (mode == CaptureMode.ScrollCapture)
        {
            bmp = ScrollCaptureEngine.Capture(boundsToCapture);
        }
        else
        {
            bmp = new Bitmap(boundsToCapture.Width, boundsToCapture.Height);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.CopyFromScreen(boundsToCapture.Left, boundsToCapture.Top, 0, 0, bmp.Size, CopyPixelOperation.SourceCopy);
            }
        }

        if (bmp == null) return null;

        return new ElementData
        {
            Name = element?.Current.Name ?? "N/A",
            ClassName = element?.Current.ClassName ?? "N/A",
            ControlType = element?.Current.ControlType?.ProgrammaticName ?? "Unknown",
            AutomationId = element?.Current.AutomationId ?? "N/A",
            FrameworkId = element?.Current.FrameworkId ?? "N/A",
            Image = bmp
        };
    }
}

public class ElementData
{
    public string Name { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string ControlType { get; set; } = "";
    public string AutomationId { get; set; } = "";
    public string FrameworkId { get; set; } = "";
    public Bitmap Image { get; set; } = null!;
}
