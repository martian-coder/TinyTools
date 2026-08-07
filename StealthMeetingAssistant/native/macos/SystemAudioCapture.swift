// Captures macOS system audio with ScreenCaptureKit and writes 16 kHz mono
// signed 16-bit little-endian PCM to stdout — the exact format the rest of
// the pipeline expects, so Node never has to resample.
//
// This is the standard ScreenCaptureKit capture pattern, also used by
// MIT-licensed tools such as sohzm/cheating-daddy. Two things are done
// differently here, and both matter for correctness:
//
//   1. Audio is read through AVAudioPCMBuffer rather than by casting the raw
//      block buffer to a flat Float32 array. ScreenCaptureKit delivers
//      *non-interleaved* stereo, so treating the block as one flat array
//      concatenates the left channel followed by the right instead of
//      interleaving them — which sounds like the call playing twice at half
//      speed. Going through the AudioBufferList keeps the channels straight.
//   2. AVAudioConverter downmixes to mono and resamples to 16 kHz on the
//      Swift side, so the audio crossing the pipe is already what the STT
//      engines want.
//
// Build:  swiftc -O -o SystemAudioCapture SystemAudioCapture.swift \
//           -framework ScreenCaptureKit -framework AVFoundation
// Needs:  macOS 13+ and Screen Recording permission for the host app.

import AVFoundation
import Foundation
import ScreenCaptureKit

let targetSampleRate = 16_000.0

@available(macOS 13.0, *)
final class SystemAudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    private let stdout = FileHandle.standardOutput
    private var converter: AVAudioConverter?
    private var outputFormat: AVAudioFormat?
    private var stream: SCStream?

    func start() async throws {
        // Excluding our own process stops the assistant from recording any
        // sound it makes itself, which would otherwise feed back into the
        // transcript.
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: false
        )

        guard let display = content.displays.first else {
            throw NSError(
                domain: "SystemAudioCapture",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "No display available to attach audio capture to"]
            )
        }

        let filter = SCContentFilter(
            display: display,
            excludingApplications: content.applications.filter {
                $0.processID == ProcessInfo.processInfo.processIdentifier
            },
            exceptingWindows: []
        )

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = Int(targetSampleRate)
        config.channelCount = 1
        config.excludesCurrentProcessAudio = true
        // Video is not wanted, but a stream needs some; keep it minimal so the
        // capture costs almost nothing.
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.showsCursor = false

        outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: targetSampleRate,
            channels: 1,
            interleaved: true
        )

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream.addStreamOutput(
            self,
            type: .audio,
            sampleHandlerQueue: DispatchQueue(label: "audio.capture")
        )
        try await stream.startCapture()
        self.stream = stream

        FileHandle.standardError.write("ready\n".data(using: .utf8)!)
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let inputBuffer = makePcmBuffer(from: sampleBuffer) else { return }
        guard let outputFormat else { return }

        if converter == nil || converter?.inputFormat != inputBuffer.format {
            converter = AVAudioConverter(from: inputBuffer.format, to: outputFormat)
        }
        guard let converter else { return }

        let ratio = outputFormat.sampleRate / inputBuffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio) + 1024
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else {
            return
        }

        var consumed = false
        var error: NSError?
        converter.convert(to: outputBuffer, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return inputBuffer
        }

        if let error {
            FileHandle.standardError.write("convert failed: \(error)\n".data(using: .utf8)!)
            return
        }
        guard outputBuffer.frameLength > 0,
              let channel = outputBuffer.int16ChannelData else { return }

        let byteCount = Int(outputBuffer.frameLength) * MemoryLayout<Int16>.size
        stdout.write(Data(bytes: channel[0], count: byteCount))
    }

    /// Wrap the sample buffer's AudioBufferList in an AVAudioPCMBuffer,
    /// preserving the channel layout instead of flattening it.
    private func makePcmBuffer(from sampleBuffer: CMSampleBuffer) -> AVAudioPCMBuffer? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription),
              let format = AVAudioFormat(streamDescription: asbd) else { return nil }

        let frames = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return nil }
        buffer.frameLength = frames

        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(frames),
            into: buffer.mutableAudioBufferList
        )
        return status == noErr ? buffer : nil
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        FileHandle.standardError.write("stream stopped: \(error)\n".data(using: .utf8)!)
        exit(1)
    }

    func stop() async {
        try? await stream?.stopCapture()
    }
}

guard #available(macOS 13.0, *) else {
    FileHandle.standardError.write(
        "ScreenCaptureKit audio capture needs macOS 13 or newer\n".data(using: .utf8)!
    )
    exit(3)
}

let capture = SystemAudioCapture()

// Exit cleanly when the parent closes the pipe or asks us to stop.
signal(SIGPIPE, SIG_IGN)
for sig in [SIGINT, SIGTERM] {
    let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
    source.setEventHandler {
        Task {
            await capture.stop()
            exit(0)
        }
    }
    source.resume()
    signal(sig, SIG_IGN)
}

Task {
    do {
        try await capture.start()
    } catch {
        // Permission denial lands here; the message goes to the overlay.
        FileHandle.standardError.write("failed to start: \(error.localizedDescription)\n".data(using: .utf8)!)
        exit(4)
    }
}

RunLoop.main.run()
