import Foundation
import Combine

// MARK: - CONFIGURATION
// Supports BYO key: Keychain first, then Info.plist fallback.
var GEMINI_API_KEY: String {
    SharedAIExecutionService.resolveGeminiApiKey()
}

struct SharedAIAnalysis {
    let title: String
    let insight: String
}

final class SharedAIExecutionService {
    /// Exact production copy when coach chat cannot use the native provider (no Gemini / third-party names).
    static let coachChatUnavailableUserMessage: String = {
        #if os(watchOS)
        return "Open Kinetix on iPhone for coach chat."
        #else
        return "Coach AI is not available on this device yet."
        #endif
    }()

    #if DEBUG && os(iOS)
    /// `KinetixPhoneTests` injects a mock `KinetixAppleIntelligenceService`. Must be `nil` in production; clear after each test.
    static var _unitTestCoachChatProvider: KinetixAppleIntelligenceService?
    #endif

    private var ollamaURL: String {
        UserDefaults.standard.string(forKey: "ollama_api_url") ?? "http://localhost:11434"
    }

    private var ollamaModel: String {
        UserDefaults.standard.string(forKey: "ollama_model") ?? "llama3.2"
    }

    static func resolveGeminiApiKey() -> String {
        if let userKey = ApiKeyStorage.shared.getKey(name: "gemini_api_key"), !userKey.isEmpty {
            return userKey
        }
        return Bundle.main.object(forInfoDictionaryKey: "GEMINI_API_KEY") as? String ?? ""
    }

    static func isOllamaAvailable() async -> Bool {
        let urlString = UserDefaults.standard.string(forKey: "ollama_api_url") ?? "http://localhost:11434"
        guard let url = URL(string: "\(urlString)/api/tags") else {
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 2.0

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                return false
            }
            return httpResponse.statusCode == 200
        } catch {
            return false
        }
    }

    func analyzeRun(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        songTitle: String? = nil,
        songArtist: String? = nil,
        songBpm: Int? = nil,
        avgCadence: Double? = nil
    ) async throws -> SharedAIAnalysis {
        if let result = try? await analyzeWithOllama(
            distance: distance,
            pace: pace,
            npi: npi,
            targetNPI: targetNPI,
            songTitle: songTitle,
            songArtist: songArtist,
            songBpm: songBpm,
            avgCadence: avgCadence
        ) {
            return result
        }

        let key = Self.resolveGeminiApiKey()
        if !key.contains("PASTE") && !key.isEmpty {
            if let result = try? await analyzeWithGemini(
                distance: distance,
                pace: pace,
                npi: npi,
                targetNPI: targetNPI,
                apiKey: key,
                songTitle: songTitle,
                songArtist: songArtist,
                songBpm: songBpm,
                avgCadence: avgCadence
            ) {
                return result
            }
        }

        return generateRuleBasedAnalysis(
            distance: distance,
            pace: pace,
            npi: npi,
            targetNPI: targetNPI,
            songTitle: songTitle,
            songArtist: songArtist,
            songBpm: songBpm,
            avgCadence: avgCadence
        )
    }

    /// Coach chat: Apple / native provider first (`KinetixAppleIntelligenceService`), then DEBUG-only Gemini when flagged, else controlled fallback.
    func ask(question: String, metrics: FormMetrics) async throws -> String {
        let apple: (text: String, usedFallback: Bool)
        #if os(iOS)
        let provider: KinetixAppleIntelligenceService = {
            #if DEBUG
            if let injected = Self._unitTestCoachChatProvider { return injected }
            #endif
            return DefaultKinetixAppleIntelligenceService.shared
        }()
        apple = await provider.generateChatResponse(question: question, metrics: metrics)
        #else
        apple = await DefaultKinetixAppleIntelligenceService.shared.generateChatResponse(question: question, metrics: metrics)
        #endif

        let trimmedApple = apple.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !apple.usedFallback && !trimmedApple.isEmpty {
            return trimmedApple
        }

        #if DEBUG
        if UserDefaults.standard.bool(forKey: "kinetix_dev_enable_gemini_coach_chat") {
            let key = Self.resolveGeminiApiKey()
            if !key.isEmpty && !key.contains("PASTE") {
                let prompt = Self.buildCoachChatPrompt(question: question, metrics: metrics)
                if let geminiText = try? await fetchGeminiResponse(prompt: prompt, apiKey: key) {
                    let trimmed = geminiText.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty {
                        return trimmed
                    }
                }
            }
        }
        #endif

        return Self.coachChatUnavailableUserMessage
    }

    #if DEBUG
    private static func buildCoachChatPrompt(question: String, metrics: FormMetrics) -> String {
        let paceStr = metrics.pace.map { String(format: "%.0f s/km", $0) } ?? "n/a"
        let distStr = metrics.distance.map { String(format: "%.2f km", $0 / 1000) } ?? "n/a"
        let cadStr = metrics.cadence.map { String(format: "%.0f spm", $0) } ?? "n/a"
        let hrStr = metrics.heartRate.map { String(format: "%.0f bpm", $0) } ?? "n/a"
        return """
        You are Kinetix, a knowledgeable running coach. Answer briefly (under 120 words), actionable, and encouraging.

        Athlete question: \(question)

        Current live context (may be incomplete if not running):
        - Pace: \(paceStr)
        - Distance: \(distStr)
        - Cadence: \(cadStr)
        - Heart rate: \(hrStr)
        """
    }
    #endif

    private func analyzeWithOllama(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        songTitle: String?,
        songArtist: String?,
        songBpm: Int?,
        avgCadence: Double?
    ) async throws -> SharedAIAnalysis {
        guard let url = URL(string: "\(ollamaURL)/api/generate") else {
            throw URLError(.badURL)
        }

        let prompt = buildAnalysisPrompt(
            distance: distance,
            pace: pace,
            npi: npi,
            targetNPI: targetNPI,
            songTitle: songTitle,
            songArtist: songArtist,
            songBpm: songBpm,
            avgCadence: avgCadence
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": ollamaModel,
            "prompt": prompt,
            "stream": false,
            "options": [
                "temperature": 0.7,
                "top_p": 0.9
            ]
        ])
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let ollamaResponse = try JSONDecoder().decode(OllamaResponse.self, from: data)
        let responseText = ollamaResponse.response?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if responseText.isEmpty {
            throw URLError(.zeroByteResource)
        }

        return parseAIResponse(responseText)
    }

    private func analyzeWithGemini(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        apiKey: String,
        songTitle: String?,
        songArtist: String?,
        songBpm: Int?,
        avgCadence: Double?
    ) async throws -> SharedAIAnalysis {
        let prompt = buildAnalysisPrompt(
            distance: distance,
            pace: pace,
            npi: npi,
            targetNPI: targetNPI,
            songTitle: songTitle,
            songArtist: songArtist,
            songBpm: songBpm,
            avgCadence: avgCadence
        )
        let responseText = try await fetchGeminiResponse(prompt: prompt, apiKey: apiKey)
        return parseAIResponse(responseText)
    }

    private func buildAnalysisPrompt(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        songTitle: String?,
        songArtist: String?,
        songBpm: Int?,
        avgCadence: Double?
    ) -> String {
        var musicBlock = ""
        if songBpm != nil || songTitle != nil || songArtist != nil || avgCadence != nil {
            let track = [songArtist, songTitle].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " — ")
            if !track.isEmpty {
                musicBlock += "\n- Linked music: \(track)"
            }
            if let bpm = songBpm, bpm > 0 {
                musicBlock += "\n- Song tempo: \(bpm) BPM (beats per minute)"
            }
            if let cad = avgCadence, cad > 0 {
                musicBlock += "\n- Avg cadence: \(Int(cad)) steps/min (spm)"
                if let bpm = songBpm, bpm > 0 {
                    let ratio = Double(bpm) / cad
                    musicBlock += String(format: "\n- Music BPM ÷ cadence ≈ %.2f (values near 0.5, 1.0, or 2.0 often feel rhythmically aligned)", ratio)
                }
            }
            musicBlock += "\n  Use this only when helpful: relate music tempo to step rhythm and perceived efficiency; do not invent BPM or cadence."
        }
        return """
        You are Kinetix AI, an intelligent running coach. Analyze this run:
        - Distance: \(String(format: "%.2f", distance)) km
        - Average Pace: \(pace) per km
        - KPS: \(Int(npi)) (Target: \(Int(targetNPI)))\(musicBlock)

        Provide a concise analysis with:
        1. A brief, scientific-sounding title (max 8 words)
        2. Key insights on performance, comparing to target KPS
        3. Specific recommendations for improvement

        Format as JSON: {"title": "...", "insight": "..."}
        """
    }

    private func parseAIResponse(_ responseText: String) -> SharedAIAnalysis {
        let cleanText = responseText
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if let jsonRange = cleanText.range(of: "\\{[^}]+\\}", options: .regularExpression) {
            let jsonString = String(cleanText[jsonRange])
            if let data = jsonString.data(using: .utf8),
               let result = try? JSONDecoder().decode(ParsedAIResult.self, from: data) {
                return SharedAIAnalysis(title: result.title, insight: result.insight)
            }
        }

        if let data = cleanText.data(using: .utf8),
           let result = try? JSONDecoder().decode(ParsedAIResult.self, from: data) {
            return SharedAIAnalysis(title: result.title, insight: result.insight)
        }

        return SharedAIAnalysis(
            title: "Run Analysis",
            insight: cleanText.isEmpty ? "Analysis unavailable" : cleanText
        )
    }

    private func generateRuleBasedAnalysis(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        songTitle: String?,
        songArtist: String?,
        songBpm: Int?,
        avgCadence: Double?
    ) -> SharedAIAnalysis {
        let kpsShown = min(100.0, max(0, npi))
        let targetShown = min(100.0, max(0, targetNPI))
        let npiDiff = kpsShown - targetShown

        var title: String
        var insight: String

        if npiDiff > 10 {
            title = "Strong Performance Above Target"
            insight = "Your KPS of \(Int(kpsShown)) is \(Int(npiDiff)) points above your target of \(Int(targetShown)). Excellent work! You're performing well above expectations."
        } else if npiDiff > 0 {
            title = "Target Achieved"
            insight = "Your KPS of \(Int(kpsShown)) meets your target of \(Int(targetShown)). Great consistency! You're on track with your goals."
        } else if npiDiff > -10 {
            title = "Near Target Performance"
            insight = "Your KPS of \(Int(kpsShown)) is \(Int(abs(npiDiff))) points below target. You're close! Focus on maintaining consistent pace."
        } else {
            title = "Below Target - Room for Improvement"
            insight = "Your KPS of \(Int(kpsShown)) is \(Int(abs(npiDiff))) points below target. Consider focusing on pace consistency and training volume."
        }

        insight += " Your \(String(format: "%.2f", distance)) km run at \(pace)/km shows good effort."
        if let bpm = songBpm, bpm > 0, let cad = avgCadence, cad > 0 {
            insight += " Music was \(bpm) BPM vs cadence \(Int(cad)) spm—compare rhythm alignment when tuning effort."
        } else if songTitle != nil || songArtist != nil {
            let t = [songArtist, songTitle].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " — ")
            if !t.isEmpty { insight += " (Music noted: \(t).)" }
        }
        return SharedAIAnalysis(title: title, insight: insight)
    }

    private func fetchGeminiResponse(prompt: String, apiKey: String) async throws -> String {
        let urlString = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=\(apiKey)"
        guard let url = URL(string: urlString) else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "contents": [["parts": [["text": prompt]]]]
        ])

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 60
        config.allowsCellularAccess = true
        let session = URLSession(configuration: config)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errMsg = String(data: data, encoding: .utf8) ?? "Unknown Error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: errMsg])
        }

        let geminiResponse = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let responseText = geminiResponse.candidates.first?.content.parts.first?.text ?? ""
        if responseText.isEmpty {
            throw URLError(.zeroByteResource, userInfo: [NSLocalizedDescriptionKey: "Empty response from AI"])
        }

        return responseText
    }
}

// MARK: - GEMINI AI COACH
@MainActor
class AICoach: ObservableObject {
    @Published var isAnalyzing = false
    @Published var result: AIResult?
    @Published var error: String?

    private let executionService = SharedAIExecutionService()

    struct AIResult: Codable, Identifiable {
        var id = UUID()
        let title: String
        let insight: String

        private enum CodingKeys: String, CodingKey {
            case title, insight
        }
    }

    static func isOllamaAvailable() async -> Bool {
        await SharedAIExecutionService.isOllamaAvailable()
    }

    func analyzeRun(
        distance: Double,
        pace: String,
        npi: Double,
        pb: Double,
        songTitle: String? = nil,
        songArtist: String? = nil,
        songBpm: Int? = nil,
        avgCadence: Double? = nil
    ) {
        isAnalyzing = true
        result = nil
        error = nil

        Task {
            do {
                let result = try await analyzeRunAsync(
                    distance: distance,
                    pace: pace,
                    npi: npi,
                    targetNPI: pb,
                    songTitle: songTitle,
                    songArtist: songArtist,
                    songBpm: songBpm,
                    avgCadence: avgCadence
                )
                await MainActor.run {
                    self.result = result
                    self.isAnalyzing = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    self.isAnalyzing = false
                }
            }
        }
    }

    func analyzeRunAsync(
        distance: Double,
        pace: String,
        npi: Double,
        targetNPI: Double,
        songTitle: String? = nil,
        songArtist: String? = nil,
        songBpm: Int? = nil,
        avgCadence: Double? = nil
    ) async throws -> AIResult {
        let result = try await executionService.analyzeRun(
            distance: distance,
            pace: pace,
            npi: npi,
            targetNPI: targetNPI,
            songTitle: songTitle,
            songArtist: songArtist,
            songBpm: songBpm,
            avgCadence: avgCadence
        )
        return AIResult(title: result.title, insight: result.insight)
    }

    func ask(question: String, metrics: FormMetrics) async -> String {
        do {
            return try await executionService.ask(question: question, metrics: metrics)
        } catch {
            let errorMsg = error.localizedDescription
            print("Ask Error: \(errorMsg)")
            print("Full error: \(error)")
            self.error = errorMsg
            return SharedAIExecutionService.coachChatUnavailableUserMessage
        }
    }
}

struct GeminiResponse: Codable {
    let candidates: [Candidate]
}

struct Candidate: Codable {
    let content: Content
}

struct Content: Codable {
    let parts: [Part]
}

struct Part: Codable {
    let text: String
}

private struct ParsedAIResult: Codable {
    let title: String
    let insight: String
}

private struct OllamaResponse: Codable {
    let response: String?
    let done: Bool?
}
