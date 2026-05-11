using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

// ANSI Color Codes for Modern Terminal Look
const string Reset = "\x1b[0m";
const string Bold = "\x1b[1m";
const string BgShade = "\x1b[48;2;24;26;31m";            // Deep rich background shade for the table panel
const string BorderColor = "\x1b[38;2;80;85;100m";        // Subtle Slate Gray
const string TitleColor = "\x1b[38;2;160;120;255m" + Bold; // Purple/Indigo
const string HeaderColor = "\x1b[38;2;100;200;255m";       // Soft Cyan
const string MismatchColor = "\x1b[38;2;255;170;50m";      // Warm Orange
const string RemovedColor = "\x1b[38;2;255;90;100m";       // Crimson Red
const string AddedColor = "\x1b[38;2;80;230;140m";         // Emerald Green
const string SummaryColor = "\x1b[38;2;200;200;200m";      // Light Gray
const string SyncColor = "\x1b[38;2;100;255;150m" + Bold;  // Bright Green
const string CmdPrefixColor = "\x1b[38;2;100;130;180m";    // Muted blue for `winget`
const string CmdHighlightColor = "\x1b[38;2;220;240;255m"; // Bright blue-white for packages

if (args.Length != 2)
{
    Console.Error.WriteLine("Usage: winget-diff <file1.json> <file2.json>");
    return 1;
}

var file1 = args[0];
var file2 = args[1];

if (!File.Exists(file1))
{
    Console.Error.WriteLine($"Error: File '{file1}' not found.");
    return 1;
}

if (!File.Exists(file2))
{
    Console.Error.WriteLine($"Error: File '{file2}' not found.");
    return 1;
}

try
{
    // Fast, modern loading spinner
    AnimateSpinner("Analyzing winget manifests...", 400);

    var packages1 = LoadPackages(file1);
    var packages2 = LoadPackages(file2);

    var allIds = packages1.Keys.Union(packages2.Keys).OrderBy(id => id).ToList();

    var onlyIn1 = new List<(string Id, string V1)>();
    var onlyIn2 = new List<(string Id, string V2)>();
    var mismatched = new List<(string Id, string V1, string V2)>();
    var inSync = new List<(string Id, string V)>();

    foreach (var id in allIds)
    {
        bool in1 = packages1.TryGetValue(id, out var v1);
        bool in2 = packages2.TryGetValue(id, out var v2);

        if (in1 && !in2)
            onlyIn1.Add((id, v1!));
        else if (!in1 && in2)
            onlyIn2.Add((id, v2!));
        else if (in1 && in2 && v1 != v2)
            mismatched.Add((id, v1!, v2!));
        else if (in1 && in2 && v1 == v2)
            inSync.Add((id, v1!));
    }

    bool hasDifferences = onlyIn1.Any() || onlyIn2.Any() || mismatched.Any();
    var f1Name = Path.GetFileName(file1);
    var f2Name = Path.GetFileName(file2);

    string DrawLine(char c) => $"{BgShade}{BorderColor}{new string(c, 95)}{Reset}";
    string FormatCell(string text, int width, string color) => $"{BgShade}{color}{text.PadRight(width)}{Reset}";
    string Border() => $"{BgShade}{BorderColor}|{Reset}";

    Console.WriteLine();
    AnimateWrite($" {TitleColor}Winget Package Diff: {f1Name} vs {f2Name}{Reset}", 1);
    AnimateWrite(DrawLine('='), 1);
    AnimateWrite($"{Border()} {FormatCell("Package Identifier", 45, HeaderColor)} {Border()} {FormatCell(f1Name, 20, HeaderColor)} {Border()} {FormatCell(f2Name, 20, HeaderColor)} {Border()}", 1);
    AnimateWrite(DrawLine('='), 1);

    if (mismatched.Any())
    {
        AnimateWrite($"{Border()} {FormatCell("VERSION MISMATCHES", 91, Bold)} {Border()}", 1);
        AnimateWrite(DrawLine('-'), 1);
        foreach (var m in mismatched)
        {
            AnimateWrite($"{Border()} {FormatCell(m.Id, 45, MismatchColor)} {Border()} {FormatCell(m.V1, 20, MismatchColor)} {Border()} {FormatCell(m.V2, 20, MismatchColor)} {Border()}", 1);
        }
        AnimateWrite(DrawLine('-'), 1);
    }

    if (onlyIn1.Any())
    {
        AnimateWrite($"{Border()} {FormatCell($"ONLY IN {f1Name.ToUpper()}", 91, Bold)} {Border()}", 1);
        AnimateWrite(DrawLine('-'), 1);
        foreach (var item in onlyIn1)
        {
            AnimateWrite($"{Border()} {FormatCell(item.Id, 45, RemovedColor)} {Border()} {FormatCell(item.V1, 20, RemovedColor)} {Border()} {FormatCell("-", 20, RemovedColor)} {Border()}", 1);
        }
        AnimateWrite(DrawLine('-'), 1);
    }

    if (onlyIn2.Any())
    {
        AnimateWrite($"{Border()} {FormatCell($"ONLY IN {f2Name.ToUpper()}", 91, Bold)} {Border()}", 1);
        AnimateWrite(DrawLine('-'), 1);
        foreach (var item in onlyIn2)
        {
            AnimateWrite($"{Border()} {FormatCell(item.Id, 45, AddedColor)} {Border()} {FormatCell("-", 20, AddedColor)} {Border()} {FormatCell(item.V2, 20, AddedColor)} {Border()}", 1);
        }
    }
    
    AnimateWrite(DrawLine('='), 1);

    if (!hasDifferences)
    {
        AnimateWrite($"\n{SyncColor}✓ All packages are perfectly in sync!{Reset}", 1);
        return 0;
    }
    else
    {
        AnimateWrite($"\n{SummaryColor}Summary: {MismatchColor}{mismatched.Count} mismatches{SummaryColor}, {RemovedColor}{onlyIn1.Count} only in {f1Name}{SummaryColor}, {AddedColor}{onlyIn2.Count} only in {f2Name}{SummaryColor}, {HeaderColor}{inSync.Count} in sync{SummaryColor}.{Reset}\n", 1);
        
        // UNIQUE KILLER FEATURE: Actionable Sync Commands
        AnimateWrite($" {TitleColor}🚀 Actionable Sync Commands{Reset}", 1);
        AnimateWrite($" {SummaryColor}Run these commands to make {f1Name} match {f2Name}:{Reset}\n", 1);
        
        foreach (var item in mismatched)
            AnimateWrite($"   {CmdPrefixColor}winget upgrade{Reset} {CmdHighlightColor}{item.Id}{Reset} {CmdPrefixColor}--version {item.V2}{Reset}");

        foreach (var item in onlyIn2)
            AnimateWrite($"   {CmdPrefixColor}winget install{Reset} {CmdHighlightColor}{item.Id}{Reset} {CmdPrefixColor}--version {item.V2}{Reset}");

        foreach (var item in onlyIn1)
            AnimateWrite($"   {CmdPrefixColor}winget uninstall{Reset} {CmdHighlightColor}{item.Id}{Reset}");

        Console.WriteLine();
        return 1;
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error processing files: {ex.Message}");
    return 1;
}

// ---------------------------------------------------------
// Animation & UI Helpers
// ---------------------------------------------------------

static void AnimateWrite(string text, int delayMs = 1)
{
    // Speed optimized typing animation
    // Prints chunks of characters to overcome the slow Thread.Sleep(1) OS resolution limit (~15ms)
    int chunkSize = 6; 
    int currentChunk = 0;

    for (int i = 0; i < text.Length; i++)
    {
        if (text[i] == '\x1b')
        {
            // Skip over ANSI escape sequences instantaneously
            while (i < text.Length && text[i] != 'm')
            {
                Console.Write(text[i]);
                i++;
            }
            if (i < text.Length) Console.Write(text[i]);
            continue;
        }
        
        Console.Write(text[i]);
        currentChunk++;
        
        if (currentChunk >= chunkSize && delayMs > 0)
        {
            Thread.Sleep(delayMs);
            currentChunk = 0;
        }
    }
    Console.WriteLine();
}

static void AnimateSpinner(string message, int durationMs)
{
    string[] spinner = new[] { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" };
    int delay = 50; // Faster spin
    int frames = durationMs / delay;
    
    Console.Write("\x1b[?25l"); // hide terminal cursor
    for (int i = 0; i < frames; i++)
    {
        Console.Write($"\r{HeaderColor}{spinner[i % spinner.Length]}{Reset} {SummaryColor}{message}{Reset}");
        Thread.Sleep(delay);
    }
    Console.Write($"\r{new string(' ', message.Length + 4)}\r"); // clear line perfectly
    Console.Write("\x1b[?25h"); // show terminal cursor
}

// Helper methods
static Dictionary<string, string> LoadPackages(string filePath)
{
    var json = File.ReadAllText(filePath);
    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
    var export = JsonSerializer.Deserialize<WingetExport>(json, options);
    
    var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (export?.Sources == null) return dict;

    foreach (var source in export.Sources)
    {
        if (source.Packages == null) continue;
        foreach (var pkg in source.Packages)
        {
            if (!string.IsNullOrEmpty(pkg.PackageIdentifier))
            {
                dict[pkg.PackageIdentifier] = pkg.Version ?? "unknown";
            }
        }
    }
    return dict;
}

// Records
record WingetExport(List<WingetSource>? Sources);
record WingetSource(List<WingetPackage>? Packages);
record WingetPackage(string? PackageIdentifier, string? Version);
