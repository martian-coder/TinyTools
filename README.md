# Autonomous Memory Engine (AME)

A high-performance, zero-allocation state management and memory engine designed natively for autonomous AI agent swarms. By bypassing traditional HTTP/JSON stacks entirely, AME implements a custom binary wire protocol over raw TCP pipelines, delivering microsecond-level retrieval and ingestion speeds optimized for machine-to-machine context consolidation.

---

## Performance Benchmarks

The following metrics were captured using the included self-hosted multi-threaded benchmark suite (`MemoryEngine.Benchmarks`) simulating a dense swarm of AI agents over 50 concurrent TCP loopback connections on .NET 10.

### Throughput & Efficiency

| Operation | Scale | Throughput | Resource Impact |
| :--- | :--- | :--- | :--- |
| **`StateAppend` (Ingestion)** | 100,000 frames | **177,437 msg/s** | Zero LOH Allocations / No GC Pauses |
| **`ContextQuery` (Retrieval)** | 10,000 round trips | **4,108 msg/s** | Strictly bounded token budget payload |

### Latency Percentiles (Round-Trip)

> Ingestion operations execute with non-blocking handoffs. Retrieval round-trips execute end-to-end (parse, score, compile, serialize, and emit) under microsecond constraints:

*   **P50 (Median):** 207.5 µs
*   **P95:** 559.8 µs
*   **P99 (Tail):** 1,575.5 µs

---

## Architectural Pillars


```
[AI Agent Swarm] ──(Nexus Binary Protocol over TCP)──> [TcpPipelineGateway]
│
(Zero-Copy SequenceReader)
│
┌────────────────────────────────┴────────────────────────────────┐
▼                                                                 ▼
[StateAppend / Evict]                                                [ContextQuery]
│                                                                 │
(Non-Blocking TryAppend)                                           (Recency & Semantic Rank)
│                                                                 │
▼                                                                 ▼
[Bounded System.Threading.Channel]                                      [ContextCompiler]
│                                                                 │
(Async Drain Loop)                                                          ▼
▼                                                    (Strict Token Budget Packing)
[Downstream Vector Index]                                                     │
│                                                                 ▼
└─────────────────> [Concurrent Repository] ──────────────────────┘
```

### 1. Zero-Allocation TCP Gateway (`System.IO.Pipelines`)
The ingest layer avoids the thread-per-connection scaling bottleneck and intermediate byte-array allocations by leveraging `.NET` core pipelines. 
* Network data streams directly into managed memory segments managed by a `PipeReader`.
* Frames are parsed synchronously out of `ReadOnlySequence<byte>` chains using a stack-allocated `SequenceReader<byte>`. 
* Buffer positions advance using `AdvanceTo` without copying payload data into intermediate arrays, bypassing the Large Object Heap (LOH) entirely.

### 2. Low-Overhead Nexus Wire Protocol
Communication utilizes a tight binary framing layout designed for direct machine execution. UTF-8 strings are only materialized when application-level text processing requires compilation.


```
+-------------------+---------------------+----------------------------+
|  MsgType (1 Byte) | Length (4 Bytes BE) |  Binary Payload (N Bytes)  |
+-------------------+---------------------+----------------------------+
```
Supported operational frames:
*   `0x01 - StateAppend`: Appends structural logs or state frames to an agent's memory track.
*   `0x02 - ContextQuery`: Requests an optimized, token-bounded context slice.
*   `0x03 - MemoryEvict`: Explicitly clears specific frames or ranges from memory storage.

### 3. Lock-Free Ingestion & Temporal Logging
Parallel execution pipelines use non-blocking coordination patterns to achieve high scaling metrics:
* Inbound frames lease memory chunks from a centralized memory allocator pool.
* Frames transition instantly to processing pipelines through a bounded `System.Threading.Channels` queue using `TryWrite`. This approach guarantees that network threads never block on backend persistence tasks.
* Frame sequences scale safely under concurrent loads through atomized tracking operations using `Interlocked`.
* A dedicated `BackgroundService` consumes the processing queue to feed background indexing tasks asynchronously.

### 4. Deterministic Context Compiler
To protect LLM engines from context saturation and lower processing costs, the retrieval pipeline optimizes payloads deterministically:
* Queries analyze relevant historical events by balancing semantic importance with temporal proximity scores.
* Compilers pack the target return layout byte-by-byte against hard token budget constraints (configured here at an approximate ratio of 1 token per 4 characters).
* Streams evaluate exact payload allocations, dropping lower-ranked objects cleanly before completing the sequence.

---

## Repository Layout

*   `src/AutonomousMemoryEngine/`: Engine core containing the socket gateway pipelines, custom protocol parsers, and internal storage compilers.
*   `src/MemoryEngine.Benchmarks/`: High-performance loopback benchmarking client simulating concurrent operational traffic without external dependencies.

---

## Getting Started

### Prerequisites
*   .NET 9 SDK or .NET 10 SDK

### Building the Project
Verify the configuration by compiling the core application:
```bash
dotnet build AutonomousMemoryEngine/AutonomousMemoryEngine.csproj

```
### Running the Verification Suite
Execute the multi-threaded self-hosted benchmark to profile throughput and latency percentiles locally:
```bash
dotnet run --project MemoryEngine.Benchmarks/MemoryEngine.Benchmarks.csproj -- --self-host 127.0.0.1 7077

```
```

```
