# Autonomous Memory Engine (AME)

A high-performance, zero-allocation state management and memory engine designed natively for autonomous AI agent swarms. By bypassing traditional HTTP/JSON stacks entirely, AME implements a custom binary wire protocol over raw TCP pipelines, delivering microsecond-level retrieval and ingestion speeds optimized for machine-to-machine context consolidation.

---

## Performance Benchmarks

The following metrics were captured using the included self-hosted multi-threaded benchmark suite simulating a dense swarm of AI agents over 50 concurrent TCP loopback connections on .NET 10.

### Throughput & Efficiency

| Operation | Scale | Throughput | Resource Impact |
| :--- | :--- | :--- | :--- |
| **`StateAppend` (Ingestion)** | 100,000 frames | **177,437 msg/s** | Zero LOH Allocations / No GC Pauses |
| **`ContextQuery` (Retrieval)** | 10,000 round trips | **4,108 msg/s** | Strictly bounded token budget payload |

### Latency Percentiles (Round-Trip)

Retrieval round-trips execute end-to-end (parse, score, compile, serialize, and emit) under microsecond constraints:

- **P50 (Median):** 207.5 µs
- **P95:** 559.8 µs
- **P99 (Tail):** 1,575.5 µs

---

## Architecture

### Zero-Allocation TCP Gateway

The ingest layer avoids thread-per-connection scaling bottlenecks and intermediate byte-array allocations by leveraging `.NET` core pipelines:

- Network data streams directly into managed memory segments via `PipeReader`
- Frames parse synchronously from `ReadOnlySequence<byte>` using stack-allocated `SequenceReader<byte>`
- Buffer positions advance using `AdvanceTo` without copying payload data
- Large Object Heap (LOH) allocations are entirely bypassed

### Binary Wire Protocol (Nexus)

Communication uses a tight binary framing layout optimized for direct machine execution:

```
+-------------------+---------------------+----------------------------+
|  MsgType (1 Byte) | Length (4 Bytes BE) |  Binary Payload (N Bytes)  |
+-------------------+---------------------+----------------------------+
```

**Message Types:**
- `0x01 - StateAppend`: Appends structural logs or state frames to an agent's memory track
- `0x02 - ContextQuery`: Requests an optimized, token-bounded context slice
- `0x03 - MemoryEvict`: Explicitly clears specific frames or ranges from memory storage

### Lock-Free Ingestion Pipeline

Parallel execution pipelines use non-blocking coordination for high-scale metrics:

- Inbound frames lease memory chunks from a centralized allocator pool
- Frames transition via `System.Threading.Channels` using non-blocking `TryWrite`
- Frame sequences scale safely under concurrent loads via `Interlocked` atomics
- A dedicated `BackgroundService` consumes the queue to feed downstream vector indexing

### Context Compiler

Deterministic retrieval optimization protects LLM engines from context saturation:

- Queries balance semantic importance with temporal proximity scores
- Compiler packs payloads byte-by-byte against hard token budgets (1 token ≈ 4 characters)
- Exact allocations are evaluated, dropping lower-ranked objects before completion

---

## Project Structure

```
AutonomousMemoryEngine/
├── TcpPipelineGateway.cs      # Socket listener, PipeReader/PipeWriter, frame dispatch
├── BinaryWireProtocol.cs      # StateAppend/ContextQuery/MemoryEvict serialization
├── TemporalLog.cs             # Channel-backed append-only event log with pooled memory
├── ContextCompiler.cs         # Semantic ranking, token-budget packing, retrieval
└── AutonomousMemoryEngine.csproj
```

---

## Prerequisites

- **.NET 9 SDK** or **.NET 10 SDK**
- No external NuGet packages required

---

## Building

Build the core engine:

```bash
dotnet build AutonomousMemoryEngine/AutonomousMemoryEngine.csproj
```

Build the benchmark harness:

```bash
dotnet build ../MemoryEngine.Benchmarks/MemoryEngine.Benchmarks.csproj
```

---

## Running

### Self-Hosted Gateway Only

```bash
dotnet run -f net9.0
```

This starts the TCP gateway on port `7077` and listens for incoming agent connections.

### Benchmark with Self-Hosted Gateway

From the repository root:

```bash
dotnet run --project MemoryEngine.Benchmarks/MemoryEngine.Benchmarks.csproj -- --self-host 127.0.0.1 7077
```

Expected output:
```
StateAppend: 100,000 messages in 0.564s => 177,437 msg/s
ContextQuery: 10,000 round trips in 2.434s => 4,108 msg/s
Latency: P50=207.5us, P95=559.8us, P99=1,575.5us
Assertions: zero socket exceptions, zero dropped frames, all query payloads within token budget.
```

---

## Design Philosophy

- **Zero-Allocation Hot Path**: All network I/O parsing uses stack-allocated `Span<T>` and `ReadOnlySequence<byte>`
- **Non-Blocking Ingestion**: TCP threads never block on downstream persistence — memory handoffs use `System.Threading.Channels`
- **Deterministic Compilation**: Context payloads are packed to exact token budgets without guess-and-retry
- **Microsecond Latency**: Target <250µs P50 retrieval latency for AI swarm context queries

---

## Next Steps

- Add persistence layer (RocksDB, SQLite) for durable memory storage
- Implement semantic vector search for ContextQuery ranking
- Add gRPC surface for polyglot agent clients
- Deploy as a Kubernetes sidecar for large-scale agent swarms
