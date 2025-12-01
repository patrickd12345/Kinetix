import Foundation
import AVFoundation

/// Lightweight real-time tone generator that translates form deviations into subtle audio.
/// The engine stays silent until the form vector drifts, then fades in with panning/pitch/tremolo cues.
final class SonicFormEngine {
    private let engine = AVAudioEngine()
    private var sourceNode: AVAudioSourceNode?
    private let audioQueue = DispatchQueue(label: "com.kinetix.sonic-form-engine")
    
    private let sampleRate: Double = 44100
    private var phase: Double = 0
    private var tremoloPhase: Double = 0
    
    private var amplitude: Double = 0
    private var targetAmplitude: Double = 0
    private var frequency: Double = 220
    private var pan: Double = 0
    private var tremoloDepth: Double = 0.2
    private var sensitivity: Double = 1.0
    
    func start(sensitivity: Double) {
        self.sensitivity = sensitivity
        configureSession()
        installSourceNodeIfNeeded()
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                print("Sonic engine failed to start: \(error.localizedDescription)")
            }
        }
    }
    
    func stop() {
        audioQueue.sync {
            self.targetAmplitude = 0
            self.amplitude = 0
        }
        engine.stop()
        sourceNode = nil
    }
    
    func update(with state: FormBubbleState, metrics: FormMetrics?, sensitivity: Double) {
        audioQueue.async {
            self.sensitivity = sensitivity
            let horizontalDrift = Double(state.normalized.x)
            let verticalDrift = Double(state.normalized.y)
            
            let magnitude = min(1.0, sqrt(horizontalDrift * horizontalDrift + verticalDrift * verticalDrift))
            let instability = min(1.0, state.instability)
            
            // Composite severity drives the gain envelope
            let severity = max(0, min(1.0, (magnitude * 0.75 + instability * 0.6) * sensitivity))
            self.targetAmplitude = severity < 0.08 ? 0 : severity * 0.35
            
            // Map VO deviation to pitch
            self.frequency = 220 + (verticalDrift * 180)
            
            // Pan mirrors left/right asymmetry
            self.pan = max(-1, min(1, horizontalDrift))
            
            // Instability adds gentle tremolo
            self.tremoloDepth = 0.15 + instability * 0.35
        }
    }
    
    private func configureSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("Failed to configure AVAudioSession: \(error.localizedDescription)")
        }
    }
    
    private func installSourceNodeIfNeeded() {
        guard sourceNode == nil else { return }
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        
        sourceNode = AVAudioSourceNode(format: format) { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
            guard let self else { return noErr }
            let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
            let dt = 1.0 / self.sampleRate
            
            for frame in 0..<Int(frameCount) {
                // Smooth the amplitude to avoid clicks
                self.amplitude += (self.targetAmplitude - self.amplitude) * 0.0025
                self.phase += 2.0 * .pi * self.frequency * dt
                if self.phase > 2.0 * .pi { self.phase -= 2.0 * .pi }
                
                self.tremoloPhase += 2.0 * .pi * 3.5 * dt // ~3.5 Hz wobble
                if self.tremoloPhase > 2.0 * .pi { self.tremoloPhase -= 2.0 * .pi }
                let tremolo = 1.0 - self.tremoloDepth + self.tremoloDepth * ((sin(self.tremoloPhase) + 1.0) * 0.5)
                
                let rawSample = sin(self.phase) * self.amplitude * tremolo
                
                let leftGain = Float(0.5 * (1.0 - self.pan))
                let rightGain = Float(0.5 * (1.0 + self.pan))
                let sample = Float(rawSample)
                
                for bufferIndex in 0..<ablPointer.count {
                    let channel = ablPointer[bufferIndex]
                    guard let data = channel.mData else { continue }
                    let samples = data.assumingMemoryBound(to: Float.self)
                    
                    let gain = bufferIndex == 0 ? leftGain : rightGain
                    samples[frame] = sample * gain
                }
            }
            
            return noErr
        }
        
        guard let sourceNode else { return }
        engine.attach(sourceNode)
        engine.connect(sourceNode, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 1.0
    }
}
