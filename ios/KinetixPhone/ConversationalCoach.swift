import Foundation
import Combine
import AVFoundation

@MainActor
class ConversationalCoach: ObservableObject {
    @Published var isListening = false
    @Published var isSpeaking = false
    @Published var conversationHistory: [ChatMessage] = []
    private let logger = DiagnosticLogManager.shared
    
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
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Listen for alerts from Watch
        connectivity.alertSubject
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.speak("Coach Alert: " + message)
                self?.conversationHistory.append(ChatMessage(sender: .coach, text: "⚠️ " + message))
            }
            .store(in: &cancellables)
    }
    
    func sendUserMessage(_ text: String) {
        // 1. Add user message to UI
        conversationHistory.append(ChatMessage(sender: .user, text: text))
        
        // 2. Add loading indicator
        let loadingMessage = ChatMessage(sender: .coach, text: "💭 Thinking...")
        conversationHistory.append(loadingMessage)
        let loadingId = loadingMessage.id
        
        // 3. Set loading state
        isSpeaking = true
        
        // 4. Capture CURRENT context from Watch stream
        let metrics = connectivity.currentMetrics
        
        // 5. Ask AI
        Task {
            do {
                let response = await aiEngine.ask(question: text, metrics: metrics)
                
                // Remove loading message
                await MainActor.run {
                    conversationHistory.removeAll { $0.id == loadingId }
                }
                
                // Check for actual errors in response
                let trimmed = response.trimmingCharacters(in: .whitespacesAndNewlines)
                
                if trimmed.isEmpty {
                    logger.log("AI returned empty response", category: "chat")
                    await MainActor.run {
                        conversationHistory.append(ChatMessage(sender: .coach, text: "⚠️ Coach is offline right now. Try again in a moment."))
                        isSpeaking = false
                    }
                } else if response.lowercased().contains("error") || response.lowercased().contains("offline") {
                    logger.log("AI response error: \(response)", category: "chat")
                    await MainActor.run {
                        conversationHistory.append(ChatMessage(sender: .coach, text: "⚠️ \(trimmed)"))
                        isSpeaking = false
                    }
                } else {
                    // Success - Add response to UI
                    await MainActor.run {
                        conversationHistory.append(ChatMessage(sender: .coach, text: trimmed))
                        isSpeaking = false
                        // Speak it!
                        speak(trimmed)
                    }
                }
            } catch {
                // Remove loading message
                await MainActor.run {
                    conversationHistory.removeAll { $0.id == loadingId }
                }
                
                logger.log("AI request failed: \(error.localizedDescription)", category: "chat")
                await MainActor.run {
                    conversationHistory.append(ChatMessage(sender: .coach, text: "⚠️ Coach offline: \(error.localizedDescription)"))
                    isSpeaking = false
                }
            }
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
