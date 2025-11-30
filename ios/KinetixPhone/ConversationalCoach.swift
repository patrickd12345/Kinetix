import Foundation
import Combine
import AVFoundation

@MainActor
class ConversationalCoach: ObservableObject {
    @Published var isListening = false
    @Published var isSpeaking = false
    @Published var conversationHistory: [ChatMessage] = []
    
    // Use shared AI logic
    private let aiEngine = AICoach()
    // Use shared Voice logic (if we wanted TTS on phone, but VoiceCoach is configured for Watch audio session)
    // For Phone, we might need a separate TTS configuration or adapt VoiceCoach.
    // For now, we will rely on the text response and basic TTS if needed.
    
    struct ChatMessage: Identifiable {
        let id = UUID()
        let sender: Sender
        let text: String
        
        enum Sender {
            case user
            case coach
        }
    }
    
    private let connectivity = ConnectivityManager.shared
    
    func sendUserMessage(_ text: String) {
        // 1. Add user message to UI
        conversationHistory.append(ChatMessage(sender: .user, text: text))
        
        // 2. Capture CURRENT context from Watch stream
        let metrics = connectivity.currentMetrics
        
        // 3. Ask AI
        Task {
            // Show thinking state? (Optional)
            
            let response = await aiEngine.ask(question: text, metrics: metrics)
            
            // 4. Add response to UI
            conversationHistory.append(ChatMessage(sender: .coach, text: response))
            
            // 5. Speak it! (Basic iOS TTS for now)
            speak(response)
        }
    }
    
    private let synthesizer = AVSpeechSynthesizer()
    
    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.52
        synthesizer.speak(utterance)
    }
}

