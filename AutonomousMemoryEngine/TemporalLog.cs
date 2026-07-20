using System.Buffers;
using System.Text;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AutonomousMemoryEngine;

public readonly record struct TemporalLogEntry(
    long Sequence,
    long AgentId,
    long TimestampUnixNanos,
    ReadOnlyMemory<byte> Payload,
    IMemoryOwner<byte> Owner) : IDisposable
{
    public void Dispose() => Owner.Dispose();
}

public sealed class TemporalLog
{
    private long _sequence;
    private readonly Channel<TemporalLogEntry> _channel;

    public TemporalLog(int capacity = 262_144)
    {
        _channel = Channel.CreateBounded<TemporalLogEntry>(new BoundedChannelOptions(capacity)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
            AllowSynchronousContinuations = false
        });
    }

    public ChannelReader<TemporalLogEntry> Reader => _channel.Reader;

    public bool TryAppend(in StateAppendMessage message)
    {
        var owner = MemoryPool<byte>.Shared.Rent(checked((int)message.StatePayload.Length));
        message.StatePayload.CopyTo(owner.Memory.Span);
        var payload = owner.Memory[..(int)message.StatePayload.Length];
        var entry = new TemporalLogEntry(
            Interlocked.Increment(ref _sequence),
            message.AgentId,
            message.TimestampUnixNanos,
            payload,
            owner);

        if (_channel.Writer.TryWrite(entry))
        {
            return true;
        }

        owner.Dispose();
        return false;
    }
}

public sealed class VectorIndexingWorker : BackgroundService
{
    private readonly TemporalLog _log;
    private readonly MemoryRepository _repository;
    private readonly ILogger<VectorIndexingWorker> _logger;

    public VectorIndexingWorker(TemporalLog log, MemoryRepository repository, ILogger<VectorIndexingWorker> logger)
    {
        _log = log;
        _repository = repository;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var entry in _log.Reader.ReadAllAsync(stoppingToken).ConfigureAwait(false))
        {
            using var owned = entry;
            var text = Encoding.UTF8.GetString(entry.Payload.Span);
            _repository.Upsert(new RetrievedMemory(entry.Sequence, entry.TimestampUnixNanos, text, SemanticScore: 0));
            _logger.LogTrace("Indexed state append {Sequence} for agent {AgentId}.", entry.Sequence, entry.AgentId);
        }
    }
}
