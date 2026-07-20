using System.Collections.Concurrent;
using System.Text;

namespace AutonomousMemoryEngine;

public readonly record struct RetrievedMemory(
    long Id,
    long TimestampUnixNanos,
    string Payload,
    double SemanticScore);

public sealed class MemoryRepository
{
    private readonly ConcurrentQueue<RetrievedMemory> _memories = new();
    private readonly ConcurrentStack<RetrievedMemory> _recent = new();

    public void Upsert(RetrievedMemory memory)
    {
        _memories.Enqueue(memory);
        _recent.Push(memory);
    }

    public IEnumerable<RetrievedMemory> Search(string query, int maxCandidates = 16)
    {
        var terms = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var inspected = 0;
        foreach (var memory in _recent)
        {
            if (inspected++ >= maxCandidates)
            {
                yield break;
            }

            yield return memory with { SemanticScore = Score(memory.Payload, terms) };
        }
    }

    private static double Score(string payload, ReadOnlySpan<string> terms)
    {
        if (terms.IsEmpty || payload.Length == 0)
        {
            return 0;
        }

        var score = 0d;
        foreach (var term in terms)
        {
            if (payload.Contains(term, StringComparison.OrdinalIgnoreCase))
            {
                score += Math.Min(1d, term.Length / 8d);
            }
        }

        return score;
    }
}

public sealed class ContextCompiler
{
    private readonly MemoryRepository _repository;

    public ContextCompiler(MemoryRepository repository)
    {
        _repository = repository;
    }

    public ReadOnlyMemory<byte> Compile(string rawQuery, int hardTokenBudget)
    {
        if (hardTokenBudget <= 0)
        {
            return ReadOnlyMemory<byte>.Empty;
        }

        var charBudget = Math.Max(0, checked(hardTokenBudget * 4) - 1);
        var builder = new StringBuilder(capacity: Math.Min(charBudget, 4096));

        foreach (var memory in _repository.Search(rawQuery)
                     .OrderByDescending(static m => m.SemanticScore)
                     .ThenByDescending(static m => m.TimestampUnixNanos))
        {
            if (builder.Length >= charBudget)
            {
                break;
            }

            var remaining = charBudget - builder.Length;
            var separatorLength = builder.Length == 0 ? 0 : Environment.NewLine.Length;
            if (remaining <= separatorLength)
            {
                break;
            }

            if (separatorLength > 0)
            {
                builder.AppendLine();
                remaining -= separatorLength;
            }

            if (memory.Payload.Length <= remaining)
            {
                builder.Append(memory.Payload);
            }
            else
            {
                builder.Append(memory.Payload.AsSpan(0, remaining));
                break;
            }
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }
}
