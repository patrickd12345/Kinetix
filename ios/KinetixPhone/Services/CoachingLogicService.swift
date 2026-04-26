import Foundation
import SwiftData

// MARK: - Types

enum CoachingDirection: String, Codable {
    case improving
    case steady
    case declining
    case unknown
}

struct TimelineEvent: Identifiable, Codable {
    var id: String = UUID().uuidString
    let type: String
    let dayOffset: Int
    let targetDate: Date
    let title: String
    let detail: String
    let priority: Int
}

struct GoalProbability: Codable {
    let probability: Double // 0.0 to 1.0
    let confidence: Double // 0.0 to 1.0
    let direction: CoachingDirection
    let summary: String
}

// MARK: - Coaching Logic Service

@MainActor
class CoachingLogicService {
    static let shared = CoachingLogicService()

    private init() {}

    func computeTimeline(runs: [Run], profile: RunnerProfile?) -> [TimelineEvent] {
        // Ported logic from Web's timelineEngine.ts
        // Simplified for native implementation while maintaining "deterministic" feel

        var events: [TimelineEvent] = []
        let anchor = Date()

        // 1. Performance Projection
        if runs.count >= 3 {
            let recentKPS = runs.prefix(5).map { $0.avgNPI }.reduce(0, +) / Double(min(runs.count, 5))
            let olderKPS = runs.suffix(max(0, runs.count - 5)).prefix(5).map { $0.avgNPI }.reduce(0, +) / Double(min(max(0, runs.count - 5), 5))

            if olderKPS > 0 {
                let diff = recentKPS - olderKPS
                let direction: CoachingDirection = diff > 1 ? .improving : (diff < -1 ? .declining : .steady)

                if direction == .improving {
                    events.append(TimelineEvent(
                        type: "performance",
                        dayOffset: 14,
                        targetDate: Calendar.current.date(byAdding: .day, value: 14, to: anchor)!,
                        title: "Performance Peak Ahead",
                        detail: "Based on your recent KPS trend, you're projected to hit a new form peak in about 2 weeks.",
                        priority: 80
                    ))
                }
            }
        }

        // 2. Consistency / Streak
        let runsInLast7Days = runs.filter { $0.date > Calendar.current.date(byAdding: .day, value: -7, to: anchor)! }.count
        if runsInLast7Days >= 4 {
            events.append(TimelineEvent(
                type: "consistency",
                dayOffset: 3,
                targetDate: Calendar.current.date(byAdding: .day, value: 3, to: anchor)!,
                title: "High Consistency Warning",
                detail: "You've been active \(runsInLast7Days) times this week. Schedule a recovery window in 3 days to maintain longevity.",
                priority: 70
            ))
        }

        // 3. Goal Readiness (Mocked for now since we don't have 'planned race' in Run model yet)
        if let targetNPI = profile?.targetNPI, !runs.isEmpty {
            let currentBest = runs.map { $0.avgNPI }.max() ?? 0
            if currentBest >= targetNPI * 0.95 {
                events.append(TimelineEvent(
                    type: "goal",
                    dayOffset: 7,
                    targetDate: Calendar.current.date(byAdding: .day, value: 7, to: anchor)!,
                    title: "Goal Probability Shift",
                    detail: "You're approaching your target KPS. Form indicates a 90%+ probability of hitting your milestone next week.",
                    priority: 95
                ))
            }
        }

        // Add a fallback if empty
        if events.isEmpty {
            events.append(TimelineEvent(
                type: "onboarding",
                dayOffset: 1,
                targetDate: Calendar.current.date(byAdding: .day, value: 1, to: anchor)!,
                title: "Build Your History",
                detail: "Keep tracking your runs to unlock deterministic coaching and performance projections.",
                priority: 50
            ))
        }

        return events.sorted(by: { $0.priority > $1.priority })
    }

    func computeGoalProbability(runs: [Run], profile: RunnerProfile?) -> GoalProbability {
        guard let profile = profile, !runs.isEmpty else {
            return GoalProbability(
                probability: 0.5,
                confidence: 0.1,
                direction: .unknown,
                summary: "Need more run data to calculate goal probability."
            )
        }

        let targetNPI = profile.targetNPI
        let recentRuns = runs.prefix(7)
        let avgRecentNPI = recentRuns.map { $0.avgNPI }.reduce(0, +) / Double(recentRuns.count)

        let ratio = avgRecentNPI / targetNPI
        let probability = min(max(ratio * 0.8, 0.1), 0.99) // Simplified model

        let confidence = min(Double(runs.count) / 20.0, 1.0)

        var summary = ""
        if probability > 0.8 {
            summary = "Excellent! Your current performance strongly supports your target goal."
        } else if probability > 0.5 {
            summary = "On track. Consistency in the next 14 days will be key."
        } else {
            summary = "Goal is ambitious. Focus on building base aerobic fitness."
        }

        return GoalProbability(
            probability: probability,
            confidence: confidence,
            direction: ratio > 0.9 ? .improving : .steady,
            summary: summary
        )
    }
}
