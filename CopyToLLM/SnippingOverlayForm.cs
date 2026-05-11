using System;
using System.Drawing;
using System.Windows.Forms;

namespace CopyToLLM;

public enum CaptureMode
{
    None,
    Region,
    AutoElement,
    FullScreen,
    ScrollCapture
}

public class SnippingOverlayForm : Form
{
    private Bitmap? _backgroundMap;
    private Point _startPoint;
    private Rectangle _selection;
    private bool _isDragging;
    private bool _moved;

    public Rectangle SelectedRegion => _selection;
    public CaptureMode Mode { get; private set; } = CaptureMode.None;
    public Point ClickPoint { get; private set; }

    public SnippingOverlayForm()
    {
        this.FormBorderStyle = FormBorderStyle.None;
        this.StartPosition = FormStartPosition.Manual;
        this.Bounds = SystemInformation.VirtualScreen;
        this.TopMost = true;
        this.ShowInTaskbar = false;
        this.DoubleBuffered = true;
        this.Cursor = Cursors.Cross;

        CaptureBackground();
    }

    private void CaptureBackground()
    {
        _backgroundMap = new Bitmap(Bounds.Width, Bounds.Height);
        using (Graphics g = Graphics.FromImage(_backgroundMap))
        {
            g.CopyFromScreen(Bounds.X, Bounds.Y, 0, 0, Bounds.Size, CopyPixelOperation.SourceCopy);
        }
        this.BackgroundImage = _backgroundMap;
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button == MouseButtons.Left)
        {
            _startPoint = e.Location;
            _isDragging = true;
            _moved = false;
            _selection = new Rectangle(e.Location, new Size(0, 0));
        }
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (_isDragging)
        {
            _moved = true;
            int x = Math.Min(_startPoint.X, e.X);
            int y = Math.Min(_startPoint.Y, e.Y);
            int w = Math.Abs(_startPoint.X - e.X);
            int h = Math.Abs(_startPoint.Y - e.Y);
            _selection = new Rectangle(x, y, w, h);
            this.Invalidate();
        }
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        if (e.Button == MouseButtons.Left && _isDragging)
        {
            _isDragging = false;
            if (!_moved || _selection.Width < 5 || _selection.Height < 5)
            {
                if (Control.ModifierKeys.HasFlag(Keys.Alt))
                {
                    Mode = CaptureMode.ScrollCapture;
                }
                else
                {
                    Mode = CaptureMode.AutoElement;
                }
                ClickPoint = new Point(e.X + Bounds.X, e.Y + Bounds.Y);
            }
            else
            {
                Mode = CaptureMode.Region;
                _selection.X += Bounds.X;
                _selection.Y += Bounds.Y;
            }
            this.DialogResult = DialogResult.OK;
            this.Close();
        }
        else if (e.Button == MouseButtons.Right)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
    }

    protected override void OnDoubleClick(EventArgs e)
    {
        base.OnDoubleClick(e);
        Mode = CaptureMode.FullScreen;
        this.DialogResult = DialogResult.OK;
        this.Close();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        using (SolidBrush dimBrush = new SolidBrush(Color.FromArgb(120, 0, 0, 0)))
        {
            Region region = new Region(this.ClientRectangle);
            if (_isDragging && _selection.Width > 0 && _selection.Height > 0)
            {
                region.Exclude(_selection);
                e.Graphics.DrawRectangle(Pens.DodgerBlue, _selection);
            }
            e.Graphics.FillRegion(dimBrush, region);
        }
        
        if (!_isDragging)
        {
            string msg = "Drag: Custom Box | Click: Auto Element | Alt+Click: Scroll Capture | Dbl-Click: Full Screen | Right-Click: Cancel";
            using (Font f = new Font("Segoe UI", 12, FontStyle.Bold))
            {
                var size = e.Graphics.MeasureString(msg, f);
                e.Graphics.DrawString(msg, f, Brushes.White, new PointF((this.Width - size.Width) / 2, 20));
            }
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _backgroundMap?.Dispose();
        }
        base.Dispose(disposing);
    }
}
