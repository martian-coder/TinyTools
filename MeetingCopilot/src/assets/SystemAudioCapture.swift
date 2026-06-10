import ScreenCaptureKit
import Foundation
import CoreMedia
import CoreAudio

// Captures system audio via ScreenCaptureKit and writes raw PCM to stdout.
// Format: 24 kHz · stereo · signed 16-bit LE — matches the Electron-side buffer contract.
// Requires macOS 12.3+. Needs Screen Recording permission in System Settings.
//
// Build: swiftc SystemAudioCapture.swift -o SystemAudioCapture -framework ScreenCaptureKit -framework Foundation

@available(macOS 12.3, *)
final class AudioOutputHandler: NSObject, SCStreamOutput, SCStreamDelegate {
    private let stdout = FileHandle.standardOutput
    private let queue = DispatchQueue(label: "audio.writer", qos: .userInteractive)

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio else { return }

        // Get the audio buffer list from the sample buffer
        var blockBuffer: CMBlockBuffer?
        var audioBufferList = AudioBufferList()
        var audioBufferListSize = MemoryLayout<AudioBufferList>.size

        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: audioBufferListSize,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: 0,
            blockBufferOut: &blockBuffer
        )

        guard status == noErr else { return }

        // SCStream delivers Float32 interleaved stereo at the configured sample rate.
        // Convert to Int16LE and blast it to stdout.
        let numBuffers = Int(audioBufferList.mNumberBuffers)
        let buffers = UnsafeBufferPointer<AudioBuffer>(
            start: &audioBufferList.mBuffers,
            count: numBuffers
        )

        for buffer in buffers {
            guard let data = buffer.mData else { continue }
            let floatCount = Int(buffer.mDataByteSize) / MemoryLayout<Float32>.size
            let floatPtr = data.bindMemory(to: Float32.self, capacity: floatCount)

            var int16Samples = [Int16](repeating: 0, count: floatCount)
            for i in 0..<floatCount {
                let clamped = max(-1.0, min(1.0, floatPtr[i]))
                int16Samples[i] = Int16(clamped * 32767.0)
            }

            int16Samples.withUnsafeBytes { rawBytes in
                let outData = Data(rawBytes)
                queue.async { [weak self] in
                    self?.stdout.write(outData)
                }
            }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("[SystemAudioCapture] Stream stopped: \(error)\n", stderr)
        exit(1)
    }
}

@available(macOS 12.3, *)
func run() async {
    // Ask for permission by listing shareable content — triggers the permission dialog.
    let content: SCShareableContent
    do {
        content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
    } catch {
        fputs("[SystemAudioCapture] Cannot get shareable content: \(error)\n", stderr)
        fputs("[SystemAudioCapture] Grant Screen Recording permission in System Settings → Privacy.\n", stderr)
        exit(1)
    }

    guard let display = content.displays.first else {
        fputs("[SystemAudioCapture] No display found\n", stderr)
        exit(1)
    }

    let config = SCStreamConfiguration()
    config.capturesAudio = true
    config.excludesCurrentProcessAudio = true
    config.sampleRate = 24000
    config.channelCount = 2
    // Minimal video config — audio-only mode still needs a video surface on macOS <15.
    config.width = 2
    config.height = 2
    config.minimumFrameInterval = CMTime(value: 1, timescale: 1) // 1 fps — lowest possible

    let filter = SCContentFilter(display: display, excludingWindows: [])
    let handler = AudioOutputHandler()
    let stream = SCStream(filter: filter, configuration: config, delegate: handler)

    do {
        try stream.addStreamOutput(handler, type: .audio, sampleHandlerQueue: .global(qos: .userInteractive))
        try await stream.startCapture()
        fputs("[SystemAudioCapture] Capturing system audio at 24kHz stereo\n", stderr)
    } catch {
        fputs("[SystemAudioCapture] Failed to start capture: \(error)\n", stderr)
        exit(1)
    }

    // Park the main task forever — the stream drives everything via callbacks.
    await withCheckedContinuation { (_: CheckedContinuation<Void, Never>) in }
}

if #available(macOS 12.3, *) {
    Task { await run() }
    RunLoop.main.run()
} else {
    fputs("[SystemAudioCapture] Requires macOS 12.3 or later\n", stderr)
    exit(1)
}
