using System.Buffers;
using System.Buffers.Binary;
using System.IO.Pipelines;
using System.Text;

namespace AutonomousMemoryEngine;

public enum AgentMessageType : byte
{
    StateAppend = 1,
    ContextQuery = 2,
    MemoryEvict = 3
}

public readonly record struct MessageFrame(AgentMessageType Type, ReadOnlySequence<byte> Payload);

public readonly record struct StateAppendMessage(long AgentId, long TimestampUnixNanos, ReadOnlySequence<byte> StatePayload);
public readonly record struct ContextQueryMessage(long AgentId, int TokenBudget, ReadOnlySequence<byte> QueryUtf8);
public readonly record struct MemoryEvictMessage(long AgentId, long BeforeUnixNanos);

public static class BinaryWireProtocol
{
    public const int HeaderLength = 5;
    public const int MaxPayloadLength = 64 * 1024;

    public static bool TryReadFrame(ref SequenceReader<byte> reader, out MessageFrame frame)
    {
        frame = default;
        var checkpoint = reader;

        if (!reader.TryRead(out var typeByte) || !reader.TryReadBigEndian(out int payloadLength))
        {
            reader = checkpoint;
            return false;
        }

        if (payloadLength < 0 || payloadLength > MaxPayloadLength)
        {
            throw new InvalidDataException($"Invalid payload length {payloadLength}.");
        }

        if (reader.Remaining < payloadLength)
        {
            reader = checkpoint;
            return false;
        }

        var payload = reader.Sequence.Slice(reader.Position, payloadLength);
        reader.Advance(payloadLength);
        frame = new MessageFrame((AgentMessageType)typeByte, payload);
        return true;
    }

    public static StateAppendMessage ReadStateAppend(in ReadOnlySequence<byte> payload)
    {
        var reader = new SequenceReader<byte>(payload);
        if (!reader.TryReadBigEndian(out long agentId) ||
            !reader.TryReadBigEndian(out long timestampUnixNanos) ||
            !reader.TryReadBigEndian(out int stateLength) ||
            stateLength < 0 || reader.Remaining < stateLength)
        {
            throw new InvalidDataException("Malformed StateAppend payload.");
        }

        var state = reader.Sequence.Slice(reader.Position, stateLength);
        reader.Advance(stateLength);
        return new StateAppendMessage(agentId, timestampUnixNanos, state);
    }

    public static ContextQueryMessage ReadContextQuery(in ReadOnlySequence<byte> payload)
    {
        var reader = new SequenceReader<byte>(payload);
        if (!reader.TryReadBigEndian(out long agentId) ||
            !reader.TryReadBigEndian(out int tokenBudget) ||
            !reader.TryReadBigEndian(out int queryLength) ||
            tokenBudget < 0 || queryLength < 0 || reader.Remaining < queryLength)
        {
            throw new InvalidDataException("Malformed ContextQuery payload.");
        }

        var query = reader.Sequence.Slice(reader.Position, queryLength);
        reader.Advance(queryLength);
        return new ContextQueryMessage(agentId, tokenBudget, query);
    }

    public static MemoryEvictMessage ReadMemoryEvict(in ReadOnlySequence<byte> payload)
    {
        var reader = new SequenceReader<byte>(payload);
        if (!reader.TryReadBigEndian(out long agentId) || !reader.TryReadBigEndian(out long beforeUnixNanos))
        {
            throw new InvalidDataException("Malformed MemoryEvict payload.");
        }

        return new MemoryEvictMessage(agentId, beforeUnixNanos);
    }

    public static void WriteFrame(PipeWriter writer, AgentMessageType type, ReadOnlySpan<byte> payload)
    {
        if (payload.Length > MaxPayloadLength)
        {
            throw new InvalidDataException($"Payload length {payload.Length} exceeds {MaxPayloadLength}.");
        }

        var span = writer.GetSpan(HeaderLength + payload.Length);
        span[0] = (byte)type;
        BinaryPrimitives.WriteInt32BigEndian(span.Slice(1, 4), payload.Length);
        payload.CopyTo(span.Slice(HeaderLength));
        writer.Advance(HeaderLength + payload.Length);
    }

    public static string DecodeUtf8(in ReadOnlySequence<byte> bytes)
    {
        if (bytes.IsSingleSegment)
        {
            return Encoding.UTF8.GetString(bytes.FirstSpan);
        }

        var length = checked((int)bytes.Length);
        var rented = ArrayPool<byte>.Shared.Rent(length);
        try
        {
            bytes.CopyTo(rented);
            return Encoding.UTF8.GetString(rented.AsSpan(0, length));
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(rented);
        }
    }
}
