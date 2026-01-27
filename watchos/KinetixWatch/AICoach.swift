import Foundation
import Combine

// MARK: - CONFIGURATION
// ⚠️ GET A KEY AT: https://aistudio.google.com/
// Supports "bring your own AI": checks Keychain first (user's key), then Info.plist (developer default)
var GEMINI_API_KEY: String {
    // First, check if user has provided their own key in Keychain
    if let userKey = ApiKeyStorage.shared.getKey(name: "gemini_api_key"),
       !userKey.isEmpty {
        return userKey
    }
    
    // Fallback to Info.plist (developer default or build-time config)
    return Bundle.main.object(forInfoDictionaryKey: "GEMINI_API_KEY") as? String ?? ""
}

// MARK: - GEMINI AI COACH
@MainActor
class AICoach: ObservableObject {
    @Published var isAnalyzing = false
    @Published var result: AIResult?
    @Published var error: String?
    
    struct AIResult: Codable, Identifiable { 
        var id = UUID()
        let title: String
        let insight: String
        
        private enum CodingKeys: String, CodingKey {
            case title, insight
        }
    }
    
    func analyzeRun(distance: Double, pace: String, kps: Double, targetKps: Double) {
        isAnalyzing = true
        result = nil
        error = nil
        
        Task {
            do {
                let result = try await analyzeRunAsync(distance: distance, pace: pace, kps: kps, targetKps: targetKps)
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
    
    /// Analyze a run using local AI (Ollama) with fallback to Gemini or rule-based
    /// Aligned with local AI architecture: prefers local, falls back to cloud
    func analyzeRunAsync(distance: Double, pace: String, kps: Double, targetKps: Double) async throws -> AIResult {
        // Try local Ollama first (aligned with local AI architecture)
        if let result = try? await analyzeWithOllama(distance: distance, pace: pace, kps: kps, targetKps: targetKps) {
            return result
        }
        
        // Fallback to Gemini if Ollama unavailable
        if !GEMINI_API_KEY.contains("PASTE") && !GEMINI_API_KEY.isEmpty {
            if let result = try? await analyzeWithGemini(distance: distance, pace: pace, kps: kps, targetKps: targetKps) {
                return result
            }
        }
        
        // Last resort: rule-based analysis (always works, no AI needed)
        return generateRuleBasedAnalysis(distance: distance, pace: pace, kps: kps, targetKps: targetKps)
    }
    
    // MARK: - Local AI (Ollama)
    
    private var ollamaURL: String {
        UserDefaults.standard.string(forKey: "ollama_api_url") ?? "http://localhost:11434"
    }
    
    private var ollamaModel: String {
        UserDefaults.standard.string(forKey: "ollama_model") ?? "llama3.2"
    }
    
    /// Check if Ollama is available and running
    public static func isOllamaAvailable() async -> Bool {
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
    
    private func analyzeWithOllama(distance: Double, pace: String, kps: Double, targetKps: Double) async throws -> AIResult {
        guard let url = URL(string: "\(ollamaURL)/api/generate") else {
            throw URLError(.badURL)
        }
        
        let prompt = buildAnalysisPrompt(distance: distance, pace: pace, kps: kps, targetKps: targetKps)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "model": ollamaModel,
            "prompt": prompt,
            "stream": false,
            "options": [
                "temperature": 0.7,
                "top_p": 0.9
            ]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        let ollamaResp = try JSONDecoder().decode(OllamaResponse.self, from: data)
        let responseText = ollamaResp.response?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        
        if responseText.isEmpty {
            throw URLError(.zeroByteResource)
        }
        
        return parseAIResponse(responseText)
    }
    
    // MARK: - Cloud Fallback (Gemini)
    
    private func analyzeWithGemini(distance: Double, pace: String, kps: Double, targetKps: Double) async throws -> AIResult {
        guard !GEMINI_API_KEY.contains("PASTE") && !GEMINI_API_KEY.isEmpty else {
            throw URLError(.badURL)
        }
        
        let prompt = buildAnalysisPrompt(distance: distance, pace: pace, kps: kps, targetKps: targetKps)
        let responseText = try await fetchGeminiResponse(prompt: prompt)
        return parseAIResponse(responseText)
    }
    
    // MARK: - Helper Methods
    
    private func buildAnalysisPrompt(distance: Double, pace: String, kps: Double, targetKps: Double) -> String {
        return """
        You are Kinetix AI, an intelligent running coach. Analyze this run:
        - Distance: \(String(format: "%.2f", distance)) km
        - Average Pace: \(pace) per km
        - KPS (Kinetix Performance Score): \(String(format: "%.1f", kps)) (Target: \(Int(targetKps)))
        
        Provide a concise analysis with:
        1. A brief, scientific-sounding title (max 8 words)
        2. Key insights on performance, comparing to target KPS
        3. Specific recommendations for improvement
        
        Format as JSON: {"title": "...", "insight": "..."}
        """
    }
    
    private func parseAIResponse(_ responseText: String) -> AIResult {
        let cleanText = responseText
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Try to find JSON object
        if let jsonRange = cleanText.range(of: "\\{[^}]+\\}", options: String.CompareOptions.regularExpression) {
            let jsonString = String(cleanText[jsonRange])
            if let data = jsonString.data(using: String.Encoding.utf8),
               let result = try? JSONDecoder().decode(AIResult.self, from: data) {
                return result
            }
        }
        
        // Fallback: try parsing the whole response as JSON
        if let data = cleanText.data(using: String.Encoding.utf8),
           let result = try? JSONDecoder().decode(AIResult.self, from: data) {
            return result
        }
        
        // Last resort: return a structured response from plain text
        return AIResult(
            title: "Run Analysis",
            insight: cleanText.isEmpty ? "Analysis unavailable" : cleanText
        )
    }
    
    private func generateRuleBasedAnalysis(distance: Double, pace: String, kps: Double, targetKps: Double) -> AIResult {
        let diff = kps - targetKps
        
        var title: String
        var insight: String
        
        if diff > 5 {
            title = "Strong Performance Above Target"
            insight = "Your KPS of \(String(format: "%.1f", kps)) is \(String(format: "%.1f", diff)) points above your target of \(Int(targetKps)). Excellent work! You're performing well above expectations."
        } else if diff >= 0 {
            title = "Target Achieved"
            insight = "Your KPS of \(String(format: "%.1f", kps)) meets your target of \(Int(targetKps)). Great consistency! You're on track with your goals."
        } else if diff > -5 {
            title = "Near Target Performance"
            insight = "Your KPS of \(String(format: "%.1f", kps)) is \(String(format: "%.1f", abs(diff))) points below target. You're close! Focus on maintaining consistent pace."
        } else {
            title = "Below Target - Room for Improvement"
            insight = "Your KPS of \(String(format: "%.1f", kps)) is \(String(format: "%.1f", abs(diff))) points below target. Consider focusing on pace consistency and training volume."
        }
        
        insight += " Your \(String(format: "%.2f", distance)) km run at \(pace)/km shows good effort."
        
        return AIResult(title: title, insight: insight)
    }
    
    // MARK: - Voice Interaction
    func ask(question: String, metrics: FormMetrics) async -> String {
        guard !GEMINI_API_KEY.contains("PASTE") && !GEMINI_API_KEY.isEmpty else {
            return "Please configure your Gemini API Key in settings."
        }
        
        let context = """
        Current Run Metrics:
        - Cadence: \(Int(metrics.cadence ?? 0)) spm
        - Vertical Oscillation: \(Int(metrics.verticalOscillation ?? 0)) cm
        - Ground Contact: \(Int(metrics.groundContactTime ?? 0)) ms
        - Heart Rate: \(Int(metrics.heartRate ?? 0)) bpm
        - Pace: \(metrics.pace ?? 0) sec/km
        
        User Question: "\(question)"
        
        Answer as a running coach. Keep it brief (under 20 words) for voice output.
        """
        
        do {
            let text = try await fetchGeminiResponse(prompt: context)
            return text.replacingOccurrences(of: "*", with: "") // Clean markdown
        } catch {
            let errorMsg = error.localizedDescription
            print("Ask Error: \(errorMsg)")
            print("Full error: \(error)")
            self.error = errorMsg
            return "Coach offline: \(errorMsg)"
        }
    }
    
    private func fetchGeminiResponse(prompt: String) async throws -> String {
        // Use gemini-2.0-flash (gemini-1.5-flash is not available)
        // v1 API is stable and works with the latest models
        let urlString = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=\(GEMINI_API_KEY)"
        guard let url = URL(string: urlString) else { throw URLError(.badURL) }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "contents": [["parts": [["text": prompt]]]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        // Use a robust URLSession configuration for WatchOS connectivity
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 60 // Give it more time to find a network
        config.allowsCellularAccess = true
        
        let session = URLSession(configuration: config)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errMsg = String(data: data, encoding: .utf8) ?? "Unknown Error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: errMsg])
        }
        
        let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let responseText = geminiResp.candidates.first?.content.parts.first?.text ?? ""
        
        if responseText.isEmpty {
            throw URLError(.zeroByteResource, userInfo: [NSLocalizedDescriptionKey: "Empty response from AI"])
        }
        
        return responseText
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

private struct OllamaResponse: Codable {
    let response: String?
    let done: Bool?
}
