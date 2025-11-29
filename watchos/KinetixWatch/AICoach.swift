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
                
                let urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\(GEMINI_API_KEY)"
                guard let url = URL(string: urlString) else { throw URLError(.badURL) }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.addValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "contents": [["parts": [["text": prompt]]]],
                    "generationConfig": ["responseMimeType": "application/json"]
                ]
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                    let errMsg = String(data: data, encoding: .utf8) ?? "Unknown Error"
                    throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: errMsg])
                }
                
                let geminiResp = try JSONDecoder().decode(GeminiResponse.self, from: data)
                
                if let text = geminiResp.candidates.first?.content.parts.first?.text,
                   let data = text.data(using: .utf8) {
                    let aiResult = try JSONDecoder().decode(AIResult.self, from: data)
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
