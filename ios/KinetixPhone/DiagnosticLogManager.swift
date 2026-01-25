import Foundation
import SwiftData

final class DiagnosticLogManager {
    static let shared = DiagnosticLogManager()
    private weak var modelContext: ModelContext?
    
    private init() {}
    
    func bind(_ context: ModelContext?) {
        self.modelContext = context
    }
    
    func log(_ message: String, category: String = "general") {
        guard let context = modelContext else { return }
        let entry = DiagnosticLogEntry(timestamp: Date(), category: category, message: message)
        context.insert(entry)
    }
    
    func exportLogs() -> String {
        guard let context = modelContext else { return "No log context bound." }
        let descriptor = FetchDescriptor<DiagnosticLogEntry>(sortBy: [SortDescriptor(\.timestamp, order: .reverse)])
        guard let entries = try? context.fetch(descriptor), !entries.isEmpty else {
            return "No diagnostic entries."
        }
        let lines = entries.map { entry in
            "[\(entry.timestamp)] [\(entry.category.uppercased())] \(entry.message)"
        }
        return lines.joined(separator: "\n")
    }
    
    func clear() {
        guard let context = modelContext else { return }
        let descriptor = FetchDescriptor<DiagnosticLogEntry>()
        if let entries = try? context.fetch(descriptor) {
            for entry in entries {
                context.delete(entry)
            }
        }
    }
}
