// Save one frame of a video as a JPEG poster (the still a <video> shows
// before it plays). Uses macOS's built-in AVFoundation, nothing to install.
//
//   swift tools/video-poster.swift <in.mp4> <out.jpg> <seconds>
//   swift tools/video-poster.swift "media/rgr-reel.mp4" media/rgr-reel_poster.jpg 12

import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count == 4, let seconds = Double(args[3]) else {
  print("usage: swift video-poster.swift <in> <out.jpg> <seconds>")
  exit(1)
}
let gen = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: args[1])))
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 1280, height: 1280)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
do {
  let cg = try gen.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
  let jpg = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: 0.8])!
  try jpg.write(to: URL(fileURLWithPath: args[2]))
  print("wrote \(args[2]) (\(jpg.count / 1024) KB)")
} catch {
  print("failed: \(error)")
  exit(1)
}
