using System.Buffers;
using System.Buffers.Binary;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using AutonomousMemoryEngine;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Threading.Channels;

const byte StateAppend = 1;
const byte ContextQuery = 2;
const int HeaderLength = 5;
const int Connections = 50;
const int StateAppendMessages = 100_000;
const int ContextQueryMessages = 10_000;
const int DefaultPort = 7077;
const int AgentCount = 256;
const int QueryTokenBudget = 256;
const int MaxReturnedBytes = QueryTokenBudget * 4;

var selfHost = args.Any(static arg => string.Equals(arg, "--self-host", StringComparison.OrdinalIgnoreCase));
var positional = args.Where(static arg => !arg.StartsWith("--", StringComparison.Ordinal)).ToArray();
var host = selfHost ? "127.0.0.1" : positional.Length > 0 ? positional[0] : "127.0.0.1";
var port = positional.Length > 1 && int.TryParse(positional[1], out var parsedPort) ? parsedPort : DefaultPort;

await using var harness = selfHost ? await SelfHostedGateway.StartAsync(port).ConfigureAwait(false) : null;

Console.WriteLine($"MemoryEngine.Benchmarks -> {host}:{port} {(selfHost ? "(self-hosted gateway)" : "")}");
Console.WriteLine($"Connections={Connections}, StateAppend={StateAppendMessages:n0}, ContextQuery={ContextQueryMessages:n0}, TokenBudget={QueryTokenBudget}");

var sockets = await OpenConnectionPoolAsync(host, port, Connections).ConfigureAwait(false);
var clients = sockets.Select(static socket => new ConnectionWorker(socket)).ToArray();

try
{
    var appendResult = await RunStateAppendFirehoseAsync(clients).ConfigureAwait(false);
    Console.WriteLine($"StateAppend: {appendResult.Messages:n0} messages in {appendResult.Elapsed.TotalSeconds:n3}s => {appendResult.Messages / appendResult.Elapsed.TotalSeconds:n0} msg/s");

    var queryResult = await RunContextQueryRoundTripsAsync(clients).ConfigureAwait(false);
    Console.WriteLine($"ContextQuery: {queryResult.Messages:n0} round trips in {queryResult.Elapsed.TotalSeconds:n3}s => {queryResult.Messages / queryResult.Elapsed.TotalSeconds:n0} msg/s");
    Console.WriteLine($"Latency: P50={queryResult.P50Microseconds:n1}us, P95={queryResult.P95Microseconds:n1}us, P99={queryResult.P99Microseconds:n1}us");

    if (appendResult.SocketExceptions != 0 || queryResult.SocketExceptions != 0)
    {
        throw new InvalidOperationException($"Socket exceptions observed. Append={appendResult.SocketExceptions}, Query={queryResult.SocketExceptions}.");
    }

    if (appendResult.DroppedFrames != 0 || queryResult.DroppedFrames != 0)
    {
        throw new InvalidOperationException($"Dropped frames observed. Append={appendResult.DroppedFrames}, Query={queryResult.DroppedFrames}.");
    }

    if (queryResult.TokenBudgetViolations != 0)
    {
        throw new InvalidOperationException($"Returned payload exceeded token budget {queryResult.TokenBudgetViolations:n0} times.");
    }

    Console.WriteLine("Assertions: zero socket exceptions, zero dropped frames, all query payloads within token budget.");
}
finally
{
    foreach (var client in clients)
    {
        client.Dispose();
    }
}

static async Task<Socket[]> OpenConnectionPoolAsync(string host, int port, int connectionCount)
{
    var sockets = new Socket[connectionCount];
    await Parallel.ForAsync(0, connectionCount, async (index, cancellationToken) =>
    {
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp)
        {
            NoDelay = true,
            SendBufferSize = 1 << 20,
            ReceiveBufferSize = 1 << 20
        };

        await socket.ConnectAsync(host, port, cancellationToken).ConfigureAwait(false);
        sockets[index] = socket;
    }).ConfigureAwait(false);

    return sockets;
}

static async Task<AppendBenchmarkResult> RunStateAppendFirehoseAsync(ConnectionWorker[] clients)
{
    var exceptions = 0;
    var dropped = 0;
    var sent = 0;
    var stopwatch = Stopwatch.StartNew();

    await Parallel.ForAsync(0, clients.Length, async (connectionIndex, cancellationToken) =>
    {
        var client = clients[connectionIndex];
        var perConnection = StateAppendMessages / clients.Length;
        var extra = connectionIndex < StateAppendMessages % clients.Length ? 1 : 0;
        var target = perConnection + extra;

        for (var i = 0; i < target; i++)
        {
            var sequence = connectionIndex + (i * clients.Length);
            var rented = BuildStateAppendFrame(sequence);
            try
            {
                await client.WriteAsync(rented.Memory, cancellationToken).ConfigureAwait(false);
                Interlocked.Increment(ref sent);
            }
            catch (SocketException)
            {
                Interlocked.Increment(ref exceptions);
                Interlocked.Increment(ref dropped);
            }
            catch (IOException ex) when (ex.InnerException is SocketException)
            {
                Interlocked.Increment(ref exceptions);
                Interlocked.Increment(ref dropped);
            }
            finally
            {
                rented.Dispose();
            }
        }
    }).ConfigureAwait(false);

    stopwatch.Stop();
    return new AppendBenchmarkResult(sent, stopwatch.Elapsed, exceptions, StateAppendMessages - sent);
}

static async Task<QueryBenchmarkResult> RunContextQueryRoundTripsAsync(ConnectionWorker[] clients)
{
    var latencyChannel = Channel.CreateBounded<long>(new BoundedChannelOptions(ContextQueryMessages)
    {
        SingleReader = true,
        SingleWriter = false
    });

    var exceptions = 0;
    var dropped = 0;
    var tokenViolations = 0;
    var completed = 0;
    var stopwatch = Stopwatch.StartNew();

    await Parallel.ForAsync(0, clients.Length, async (connectionIndex, cancellationToken) =>
    {
        var client = clients[connectionIndex];
        var perConnection = ContextQueryMessages / clients.Length;
        var extra = connectionIndex < ContextQueryMessages % clients.Length ? 1 : 0;
        var target = perConnection + extra;

        for (var i = 0; i < target; i++)
        {
            var sequence = connectionIndex + (i * clients.Length);
            var rented = BuildContextQueryFrame(sequence);
            try
            {
                var started = Stopwatch.GetTimestamp();
                await client.WriteAsync(rented.Memory, cancellationToken).ConfigureAwait(false);
                var payloadLength = await client.ReadFrameAsync(cancellationToken).ConfigureAwait(false);
                var elapsedTicks = Stopwatch.GetTimestamp() - started;

                if (payloadLength >= MaxReturnedBytes)
                {
                    Interlocked.Increment(ref tokenViolations);
                }

                latencyChannel.Writer.TryWrite(elapsedTicks);
                Interlocked.Increment(ref completed);
            }
            catch (SocketException)
            {
                Interlocked.Increment(ref exceptions);
                Interlocked.Increment(ref dropped);
            }
            catch (IOException ex) when (ex.InnerException is SocketException)
            {
                Interlocked.Increment(ref exceptions);
                Interlocked.Increment(ref dropped);
            }
            finally
            {
                rented.Dispose();
            }
        }
    }).ConfigureAwait(false);

    latencyChannel.Writer.Complete();
    stopwatch.Stop();

    var latencies = new long[completed];
    var index = 0;
    await foreach (var latency in latencyChannel.Reader.ReadAllAsync().ConfigureAwait(false))
    {
        latencies[index++] = latency;
    }

    Array.Sort(latencies, 0, index);
    return new QueryBenchmarkResult(
        completed,
        stopwatch.Elapsed,
        exceptions,
        ContextQueryMessages - completed,
        tokenViolations,
        PercentileMicroseconds(latencies.AsSpan(0, index), 0.50),
        PercentileMicroseconds(latencies.AsSpan(0, index), 0.95),
        PercentileMicroseconds(latencies.AsSpan(0, index), 0.99));
}

static RentedFrame BuildStateAppendFrame(int sequence)
{
    Span<byte> payload = stackalloc byte[128];
    BinaryPrimitives.WriteInt64BigEndian(payload, sequence % AgentCount);
    BinaryPrimitives.WriteInt64BigEndian(payload[8..], Stopwatch.GetTimestamp());

    var stateText = $"agent={sequence % AgentCount};seq={sequence};kind=state;memory=autonomous swarm telemetry vector candidate";
    var stateLength = Encoding.UTF8.GetBytes(stateText, payload[20..]);
    BinaryPrimitives.WriteInt32BigEndian(payload[16..], stateLength);

    return BuildFrame(StateAppend, payload[..(20 + stateLength)]);
}

static RentedFrame BuildContextQueryFrame(int sequence)
{
    Span<byte> payload = stackalloc byte[128];
    BinaryPrimitives.WriteInt64BigEndian(payload, sequence % AgentCount);
    BinaryPrimitives.WriteInt32BigEndian(payload[8..], QueryTokenBudget);

    var queryText = $"agent {sequence % AgentCount} telemetry memory";
    var queryLength = Encoding.UTF8.GetBytes(queryText, payload[16..]);
    BinaryPrimitives.WriteInt32BigEndian(payload[12..], queryLength);

    return BuildFrame(ContextQuery, payload[..(16 + queryLength)]);
}

static RentedFrame BuildFrame(byte messageType, ReadOnlySpan<byte> payload)
{
    var frameLength = HeaderLength + payload.Length;
    var owner = MemoryPool<byte>.Shared.Rent(frameLength);
    var span = owner.Memory.Span[..frameLength];
    span[0] = messageType;
    BinaryPrimitives.WriteInt32BigEndian(span[1..HeaderLength], payload.Length);
    payload.CopyTo(span[HeaderLength..]);
    return new RentedFrame(owner, frameLength);
}

static double PercentileMicroseconds(ReadOnlySpan<long> sortedTicks, double percentile)
{
    if (sortedTicks.IsEmpty)
    {
        return 0;
    }

    var index = (int)Math.Ceiling(percentile * sortedTicks.Length) - 1;
    index = Math.Clamp(index, 0, sortedTicks.Length - 1);
    return sortedTicks[index] * 1_000_000.0 / Stopwatch.Frequency;
}

internal sealed class SelfHostedGateway : IAsyncDisposable
{
    private readonly CancellationTokenSource _stop = new();
    private readonly ILoggerFactory _loggerFactory;
    private readonly TcpPipelineGateway _gateway;
    private readonly VectorIndexingWorker _worker;

    private SelfHostedGateway(ILoggerFactory loggerFactory, TcpPipelineGateway gateway, VectorIndexingWorker worker)
    {
        _loggerFactory = loggerFactory;
        _gateway = gateway;
        _worker = worker;
    }

    public static async Task<SelfHostedGateway> StartAsync(int port)
    {
        var loggerFactory = LoggerFactory.Create(static builder => builder.SetMinimumLevel(LogLevel.Warning));
        var repository = new MemoryRepository();
        var temporalLog = new TemporalLog(capacity: 100_000 + 8_192);
        var compiler = new ContextCompiler(repository);
        var endpoint = new IPEndPoint(IPAddress.Loopback, port);
        var gateway = new TcpPipelineGateway(endpoint, temporalLog, compiler, loggerFactory.CreateLogger<TcpPipelineGateway>());
        var worker = new VectorIndexingWorker(temporalLog, repository, loggerFactory.CreateLogger<VectorIndexingWorker>());
        var selfHosted = new SelfHostedGateway(loggerFactory, gateway, worker);

        await worker.StartAsync(selfHosted._stop.Token).ConfigureAwait(false);
        await gateway.StartAsync(selfHosted._stop.Token).ConfigureAwait(false);
        await Task.Delay(250, selfHosted._stop.Token).ConfigureAwait(false);
        return selfHosted;
    }

    public async ValueTask DisposeAsync()
    {
        await _stop.CancelAsync().ConfigureAwait(false);
        await _gateway.StopAsync(CancellationToken.None).ConfigureAwait(false);
        await _worker.StopAsync(CancellationToken.None).ConfigureAwait(false);
        _gateway.Dispose();
        _worker.Dispose();
        _loggerFactory.Dispose();
        _stop.Dispose();
    }
}

internal sealed class ConnectionWorker : IDisposable
{
    private readonly Socket _socket;
    private readonly NetworkStream _stream;
    private readonly byte[] _header = new byte[5];

    public ConnectionWorker(Socket socket)
    {
        _socket = socket;
        _stream = new NetworkStream(socket, ownsSocket: true);
    }

    public ValueTask WriteAsync(ReadOnlyMemory<byte> frame, CancellationToken cancellationToken)
        => _stream.WriteAsync(frame, cancellationToken);

    public async ValueTask<int> ReadFrameAsync(CancellationToken cancellationToken)
    {
        await ReadExactlyAsync(_header, cancellationToken).ConfigureAwait(false);

        if (_header[0] != 2)
        {
            throw new InvalidDataException($"Expected ContextQuery response, received message type {_header[0]}.");
        }

        var payloadLength = BinaryPrimitives.ReadInt32BigEndian(_header.AsSpan(1, 4));
        if (payloadLength < 0)
        {
            throw new InvalidDataException($"Invalid response payload length {payloadLength}.");
        }

        var owner = MemoryPool<byte>.Shared.Rent(payloadLength);
        try
        {
            await ReadExactlyAsync(owner.Memory[..payloadLength], cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            owner.Dispose();
        }

        return payloadLength;
    }

    private async ValueTask ReadExactlyAsync(Memory<byte> destination, CancellationToken cancellationToken)
    {
        while (!destination.IsEmpty)
        {
            var read = await _stream.ReadAsync(destination, cancellationToken).ConfigureAwait(false);
            if (read == 0)
            {
                throw new EndOfStreamException("Gateway closed the TCP connection before a complete frame was received.");
            }

            destination = destination[read..];
        }
    }

    public void Dispose()
    {
        _stream.Dispose();
        _socket.Dispose();
    }
}

internal readonly struct RentedFrame : IDisposable
{
    private readonly IMemoryOwner<byte> _owner;

    public RentedFrame(IMemoryOwner<byte> owner, int length)
    {
        _owner = owner;
        Memory = owner.Memory[..length];
    }

    public ReadOnlyMemory<byte> Memory { get; }

    public void Dispose() => _owner.Dispose();
}

internal readonly record struct AppendBenchmarkResult(int Messages, TimeSpan Elapsed, int SocketExceptions, int DroppedFrames);
internal readonly record struct QueryBenchmarkResult(
    int Messages,
    TimeSpan Elapsed,
    int SocketExceptions,
    int DroppedFrames,
    int TokenBudgetViolations,
    double P50Microseconds,
    double P95Microseconds,
    double P99Microseconds);
