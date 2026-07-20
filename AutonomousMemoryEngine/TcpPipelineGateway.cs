using System.Buffers;
using System.IO.Pipelines;
using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AutonomousMemoryEngine;

public sealed class TcpPipelineGateway : BackgroundService
{
    private readonly IPEndPoint _endpoint;
    private readonly TemporalLog _log;
    private readonly ContextCompiler _contextCompiler;
    private readonly ILogger<TcpPipelineGateway> _logger;
    private Socket? _listener;

    public TcpPipelineGateway(IPEndPoint endpoint, TemporalLog log, ContextCompiler contextCompiler, ILogger<TcpPipelineGateway> logger)
    {
        _endpoint = endpoint;
        _log = log;
        _contextCompiler = contextCompiler;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _listener = new Socket(_endpoint.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        _listener.Bind(_endpoint);
        _listener.Listen(backlog: 4096);

        while (!stoppingToken.IsCancellationRequested)
        {
            var socket = await _listener.AcceptAsync(stoppingToken).ConfigureAwait(false);
            _ = Task.Run(() => ProcessSocketAsync(socket, stoppingToken), stoppingToken);
        }
    }

    private async Task ProcessSocketAsync(Socket socket, CancellationToken cancellationToken)
    {
        await using var stream = new NetworkStream(socket, ownsSocket: true);
        var reader = PipeReader.Create(stream, new StreamPipeReaderOptions(bufferSize: 16 * 1024, minimumReadSize: 4 * 1024));
        var writer = PipeWriter.Create(stream, new StreamPipeWriterOptions(minimumBufferSize: 4 * 1024));

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var result = await reader.ReadAsync(cancellationToken).ConfigureAwait(false);
                var buffer = result.Buffer;
                var consumed = buffer.Start;
                var examined = buffer.End;

                try
                {
                    var sequenceReader = new SequenceReader<byte>(buffer);
                    var shouldFlush = false;
                    while (BinaryWireProtocol.TryReadFrame(ref sequenceReader, out var frame))
                    {
                        shouldFlush |= Dispatch(frame, writer);
                    }

                    consumed = sequenceReader.Position;
                    examined = buffer.End;

                    if (shouldFlush)
                    {
                        await writer.FlushAsync(cancellationToken).ConfigureAwait(false);
                    }
                }
                finally
                {
                    reader.AdvanceTo(consumed, examined);
                }

                if (result.IsCompleted)
                {
                    break;
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "TCP pipeline session terminated.");
        }
        finally
        {
            await writer.CompleteAsync().ConfigureAwait(false);
            await reader.CompleteAsync().ConfigureAwait(false);
        }
    }

    private bool Dispatch(MessageFrame frame, PipeWriter writer)
    {
        switch (frame.Type)
        {
            case AgentMessageType.StateAppend:
                if (!_log.TryAppend(BinaryWireProtocol.ReadStateAppend(frame.Payload)))
                {
                    throw new IOException("Temporal ingestion channel is saturated.");
                }

                return false;
            case AgentMessageType.ContextQuery:
                var query = BinaryWireProtocol.ReadContextQuery(frame.Payload);
                var queryText = BinaryWireProtocol.DecodeUtf8(query.QueryUtf8);
                var compiled = _contextCompiler.Compile(queryText, query.TokenBudget);
                BinaryWireProtocol.WriteFrame(writer, AgentMessageType.ContextQuery, compiled.Span);
                return true;
            case AgentMessageType.MemoryEvict:
                _logger.LogTrace("Received memory eviction request: {@Evict}.", BinaryWireProtocol.ReadMemoryEvict(frame.Payload));
                return false;
            default:
                throw new InvalidDataException($"Unknown message type {frame.Type}.");
        }
    }
}
