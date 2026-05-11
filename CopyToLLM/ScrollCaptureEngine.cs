using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

namespace CopyToLLM;

public static class ScrollCaptureEngine
{
    [DllImport("user32.dll")]
    static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    
    [DllImport("user32.dll")]
    static extern bool SetCursorPos(int X, int Y);
    
    private const int MOUSEEVENTF_WHEEL = 0x0800;

    public static Bitmap? Capture(Rectangle bounds, int maxScrolls = 50)
    {
        if (bounds.IsEmpty || bounds.Width <= 0 || bounds.Height <= 0) return null;

        SetCursorPos(bounds.X + bounds.Width / 2, bounds.Y + bounds.Height / 2);
        Thread.Sleep(50);

        Bitmap currentStitch = CaptureRegion(bounds);
        Bitmap lastFrame = (Bitmap)currentStitch.Clone();
        
        int frameH = currentStitch.Height;
        int frameW = currentStitch.Width;
        int maxY = (int)(frameH * 0.9);
        int footerH = frameH - maxY;

        int scrollAmount = -200; // Safe scroll amount to ensure generous overlap

        for (int i = 0; i < maxScrolls; i++)
        {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollAmount, 0);
            Thread.Sleep(400); // Wait for Electron rendering

            Bitmap nextFrame = CaptureRegion(bounds);

            int delta = FindDelta(lastFrame, nextFrame);
            if (delta <= 0) 
            {
                nextFrame.Dispose();
                break;
            }

            int newHeight = currentStitch.Height + delta;
            Bitmap newStitch = new Bitmap(frameW, newHeight);
            using (Graphics g = Graphics.FromImage(newStitch))
            {
                // Keep currentStitch minus its footer
                int keepH = currentStitch.Height - footerH;
                g.DrawImage(currentStitch, new Rectangle(0, 0, frameW, keepH), new Rectangle(0, 0, frameW, keepH), GraphicsUnit.Pixel);
                
                // Append nextFrame's new content and footer
                int appendH = delta + footerH;
                g.DrawImage(nextFrame, new Rectangle(0, keepH, frameW, appendH), new Rectangle(0, maxY - delta, frameW, appendH), GraphicsUnit.Pixel);
            }

            currentStitch.Dispose();
            lastFrame.Dispose();
            currentStitch = newStitch;
            lastFrame = nextFrame;
        }

        lastFrame.Dispose();
        return currentStitch;
    }

    private static Bitmap CaptureRegion(Rectangle bounds)
    {
        Bitmap bmp = new Bitmap(bounds.Width, bounds.Height);
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bmp.Size, CopyPixelOperation.SourceCopy);
        }
        return bmp;
    }

    private static int FindDelta(Bitmap lastFrame, Bitmap nextFrame)
    {
        int w = lastFrame.Width;
        int h = lastFrame.Height;

        // Valid content bounds (ignoring headers, footers, scrollbars, and minimaps)
        int minY = (int)(h * 0.2);
        int maxY = (int)(h * 0.9);
        int startX = (int)(w * 0.1);
        int endX = (int)(w * 0.75);

        BitmapData d1 = lastFrame.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        BitmapData d2 = nextFrame.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

        int stride = Math.Abs(d1.Stride);
        int bytes = stride * h;
        byte[] p1 = new byte[bytes];
        Marshal.Copy(d1.Scan0, p1, 0, bytes);
        byte[] p2 = new byte[bytes];
        Marshal.Copy(d2.Scan0, p2, 0, bytes);

        lastFrame.UnlockBits(d1);
        nextFrame.UnlockBits(d2);

        // Check if identical (reached bottom)
        float mae0 = CalculateMAE(p1, p2, stride, 0, minY, maxY, startX, endX);
        if (mae0 < 5.0f) return 0; 

        int bestDelta = 0;
        float minMAE = float.MaxValue;
        int maxDelta = (maxY - minY) - 50; // Require at least 50px overlap for a valid signature

        for (int delta = 5; delta < maxDelta; delta++)
        {
            float mae = CalculateMAE(p1, p2, stride, delta, minY, maxY, startX, endX);
            if (mae < minMAE)
            {
                minMAE = mae;
                bestDelta = delta;
            }
        }

        if (minMAE > 20.0f) return 0; // Stitching failed due to high variance
        return bestDelta;
    }

    private static float CalculateMAE(byte[] p1, byte[] p2, int stride, int delta, int minY, int maxY, int startX, int endX)
    {
        int overlapH = (maxY - minY) - delta;
        if (overlapH <= 0) return float.MaxValue;

        long totalDiff = 0;
        int count = 0;

        for (int y = 0; y < overlapH; y += 4) // sample every 4th row
        {
            int row1 = (minY + delta + y) * stride;
            int row2 = (minY + y) * stride;
            for (int x = startX; x < endX; x += 4) // sample every 4th col
            {
                int idx1 = row1 + x * 4;
                int idx2 = row2 + x * 4;
                totalDiff += Math.Abs(p1[idx1] - p2[idx2]) +
                             Math.Abs(p1[idx1+1] - p2[idx2+1]) +
                             Math.Abs(p1[idx1+2] - p2[idx2+2]);
                count++;
            }
        }
        return (float)totalDiff / count;
    }
}
