import Foundation
#if canImport(Speech)
import Speech
#endif
import AVFoundation
import SwiftUI

@MainActor
class VoiceCoach: NSObject, ObservableObject {
    #if canImport(Speech)
    // Conform to Delegate only if Speech is available
    // (Cannot conditionally conform in Swift easily here without extension)
    // So we will just implement methods without protocol conformance check
    #endif
    
    @Published var isListening = false
    @Published var isSpeaking = false
    @Published var transcription = ""
    
    #if canImport(Speech)
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    #endif
    
    private let audioEngine = AVAudioEngine()
    private let synthesizer = AVSpeechSynthesizer()
    
    override init() {
        super.init()
        #if canImport(Speech)
        // Manually set delegate if possible, but since we removed conformance from class decl to simplify...
        // actually SFSpeechRecognizerDelegate is needed for callbacks
        // speechRecognizer?.delegate = self 
        #endif
        setupAudioSession()
    }
    
    private func setupAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            // PlayAndRecord allows input (mic) and output (speaker)
            // watchOS handles routing automatically
            try audioSession.setCategory(.playAndRecord, mode: .default)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("VoiceCoach: Audio session setup failed: \(error)")
        }
    }
    
    // MARK: - Speech Recognition (Listening)
    
    func startListening(completion: @escaping (String) -> Void) {
        guard !isListening else { return }
        
        #if canImport(Speech)
        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            print("VoiceCoach: Recognizer not available")
            return
        }
        
        // Cancel previous task
        recognitionTask?.cancel()
        recognitionTask = nil
        
        do {
            // Reset audio session for recording
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            
            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest = recognitionRequest else { return }
            recognitionRequest.shouldReportPartialResults = true
            
            let inputNode = audioEngine.inputNode
            
            recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                guard let self = self else { return }
                
                var isFinal = false
                
                if let result = result {
                    self.transcription = result.bestTranscription.formattedString
                    isFinal = result.isFinal
                }
                
                if error != nil || isFinal {
                    self.stopListening()
                    inputNode.removeTap(onBus: 0)
                    if let finalResult = result?.bestTranscription.formattedString {
                        completion(finalResult)
                    }
                }
            }
            
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                recognitionRequest.append(buffer)
            }
            
            try audioEngine.start()
            isListening = true
            
        } catch {
            print("VoiceCoach: Listening failed: \(error)")
            stopListening()
        }
        #else
        print("VoiceCoach: Speech module not available")
        completion("Test Question (Speech module missing)")
        #endif
    }
    
    func stopListening() {
        #if canImport(Speech)
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        #endif
        isListening = false
        
        // Restore audio session for playback/system
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    }
    
    // MARK: - Text to Speech (Speaking)
    
    func speak(_ text: String) {
        guard !text.isEmpty else { return }
        
        // Ensure audio session is ready for playback
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .voicePrompt, options: .duckOthers)
            try session.setActive(true)
        } catch {
            print("VoiceCoach: Audio session for playback failed: \(error)")
        }
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.5 // Slightly slower for clarity while running
        utterance.pitchMultiplier = 1.0
        
        isSpeaking = true
        synthesizer.speak(utterance)
    }
    
    // Permission Check
    func requestPermissions() {
        #if canImport(Speech)
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                switch status {
                case .authorized: print("VoiceCoach: Speech authorized")
                default: print("VoiceCoach: Speech denied/restricted")
                }
            }
        }
        #endif
    }
}

#if canImport(Speech)
extension VoiceCoach: SFSpeechRecognizerDelegate {}
#endif
