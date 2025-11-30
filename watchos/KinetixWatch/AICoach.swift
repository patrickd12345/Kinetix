import Foundation
import Combine

// MARK: - CONFIGURATION
// ⚠️ GET A KEY AT: https://aistudio.google.com/
var GEMINI_API_KEY: String {
    Bundle.main.object(forInfoDictionaryKey: "GEMINI_API_KEY") as? String ?? ""
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
    
    func analyzeRun(distance: Double, pace: String, npi: Double, pb: Double) {
        guard !GEMINI_API_KEY.contains("PASTE") && !GEMINI_API_KEY.isEmpty else {
            self.error = "Invalid API Key"
            return
        }
        
        isAnalyzing = true
        result = nil
        error = nil
        
        Task {
            do {
                let prompt = "You are Kinetix AI. Analyze: Dist \(distance)km, Pace \(pace), NPI \(Int(npi)), Target \(Int(pb)). Provide JSON with keys: title (Scientific Title), insight (Feedback)."
                let responseText = try await fetchGeminiResponse(prompt: prompt)
                
                if let data = responseText.data(using: .utf8) {
                    // Attempt to clean JSON markdown if present
                    let cleanText = responseText.replacingOccurrences(of: "```json", with: "").replacingOccurrences(of: "```", with: "")
                    let cleanData = cleanText.data(using: .utf8) ?? data
                    
                    let aiResult = try JSONDecoder().decode(AIResult.self, from: cleanData)
                    self.result = aiResult
                } else {
                    throw URLError(.cannotParseResponse)
                }
                
            } catch {
                self.error = error.localizedDescription
                print("AI Error: \(error)")
            }
            
            self.isAnalyzing = false
        }
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
            print("Ask Error: \(error)")
            // Return the actual error for debugging
            return "Connection error: \(error.localizedDescription)"
        }
    }
    
    private func fetchGeminiResponse(prompt: String) async throws -> String {
        let urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\(GEMINI_API_KEY)"
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
        return geminiResp.candidates.first?.content.parts.first?.text ?? ""
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
