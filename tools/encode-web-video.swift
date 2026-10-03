// Re-encode a video into a web copy for the site: H.264 High, 1080p max,
// Rec.709 8-bit, no audio, fast start. Uses macOS's built-in encoder, so
// nothing needs installing. See MEDIA-GUIDE.md → "Video export (web)".
//
//   swift tools/encode-web-video.swift <in.mp4> <out.mp4> <target Mbps>
//   swift tools/encode-web-video.swift "media/RGR_Woke Up.mp4" media/RGR_woke-up_web.mp4 5
//
// Audio is dropped on purpose: this is for muted background loops. Export the
// watch reel from your editor instead (it needs its audio).

import AVFoundation

let args = CommandLine.arguments
guard args.count == 4, let mbps = Double(args[3]) else {
  print("usage: swift encode-web-video.swift <in> <out> <target Mbps>")
  exit(1)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: outURL)

let asset = AVURLAsset(url: inURL)
guard let track = asset.tracks(withMediaType: .video).first else {
  print("no video track in \(args[1])")
  exit(1)
}

// Fit inside 1920×1080, keep aspect, even dimensions.
let src = track.naturalSize
let scale = min(1, 1920 / src.width, 1080 / src.height)
let width = Int((src.width * scale / 2).rounded()) * 2
let height = Int((src.height * scale / 2).rounded()) * 2
let fps = max(1, Int(track.nominalFrameRate.rounded()))

let rec709: [String: Any] = [
  AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
  AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
  AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
]

let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
  AVVideoColorPropertiesKey: rec709,
])
output.alwaysCopiesSampleData = false
reader.add(output)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true  // moov before mdat ("fast start")
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoColorPropertiesKey: rec709,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: Int(mbps * 1_000_000),
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
    AVVideoExpectedSourceFrameRateKey: fps,
    AVVideoMaxKeyFrameIntervalKey: fps * 2,
    AVVideoAllowFrameReorderingKey: true,
  ],
])
input.expectsMediaDataInRealTime = false
input.transform = track.preferredTransform
writer.add(input)

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)

while let sample = output.copyNextSampleBuffer() {
  while !input.isReadyForMoreMediaData { usleep(2000) }
  if !input.append(sample) { break }
}
input.markAsFinished()

let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()

if writer.status != .completed || reader.status == .failed {
  print("failed: \(writer.error ?? reader.error as Any)")
  exit(1)
}
// The fast-start rewrite can leave its pre-rewrite temp file behind ("<out>.sb-…").
let dir = outURL.deletingLastPathComponent()
for name in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
where name.hasPrefix(outURL.lastPathComponent + ".sb-") {
  try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))
}
let bytes = (try? FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? Int) ?? 0
print(String(format: "%@ → %dx%d @ %d fps, %.1f MB", outURL.lastPathComponent, width, height, fps, Double(bytes) / 1_048_576))
