namespace CopyToLLM;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Console.WriteLine("CopyToLLM started! Waiting for Ctrl+Shift+C in the background...");
        Application.Run(new HiddenContext());
    }
}
