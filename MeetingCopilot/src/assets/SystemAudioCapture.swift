import Foundation
import ScreenCaptureKit
import AVFoundation

// Captures system audio via ScreenCaptureKit and writes raw 24kHz stereo Int16LE PCM to stdout.
// Build: swiftc -o SystemAudioCapture SystemAudioCapture.swift -framework ScreenCaptureKit -framework AVFoundation

class AudioOutputHandler: NSObject, SCStreamOutput, SCStreamDelegate {
    let outputStream = FileHandle.standardOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio else { return }
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }

        var length = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)

        guard let ptr = dataPointer, length > 0 else { return }

        let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer)
        guard let asbd = formatDesc.map({ CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }) else { return }

        // Convert Float32 → Int16LE
        let floatCount = length / MemoryLayout<Float32>.size
        let floatPtr = UnsafeBufferPointer(start: UnsafeRawPointer(ptr).bindMemory(to: Float32.self, capacity: floatCount), count: floatCount)
        var pcm16 = Data(capacity: floatCount * 2)
        for sample in floatPtr {
            let clamped = max(-1.0, min(1.0, sample))
            let int16 = Int16(clamped * 32767.0)
            withUnsafeBytes(of: int16.littleEndian) { pcm16.append(contentsOf: $0) }
        }
        outputStream.write(pcm16)
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("Stream stopped: \(error)\n", stderr)
        exit(1)
    }
}

func run() async {
    let availableContent: SCShareableContent
    do {
        availableContent = try await SCShareableContent.current
    } catch {
        fputs("SCShareableContent error: \(error)\n", stderr)
        exit(1)
    }

    guard let display = availableContent.displays.first else {
        fputs("No display found\n", stderr)
        exit(1)
    }

    let filter = SCContentFilter(display: display, excludingWindows: [])

    let config = SCStreamConfiguration()
    config.capturesAudio = true
    config.excludesCurrentProcessAudio = false
    config.sampleRate = 24000
    config.channelCount = 2

    let handler = AudioOutputHandler()
    let stream = SCStream(filter: filter, configuration: config, delegate: handler)

    do {
        try stream.addStreamOutput(handler, type: .audio, sampleHandlerQueue: .global(qos: .userInteractive))
        try await stream.startCapture()
    } catch {
        fputs("Stream start error: \(error)\n", stderr)
        exit(1)
    }

    // Run until process is killed
    await withCheckedContinuation { (_: CheckedContinuation<Void, Never>) in }
}

Task { await run() }
RunLoop.main.run()
