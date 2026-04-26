import SwiftUI
import SwiftData

struct CoachingDashboardView: View {
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Query private var profiles: [RunnerProfile]

    @State private var timeline: [TimelineEvent] = []
    @State private var probability: GoalProbability?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // 1. Goal Probability Card (Glass)
                if let prob = probability {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("GOAL PROBABILITY")
                                .font(.system(size: 12, weight: .black))
                                .tracking(2)
                                .foregroundColor(.cyan)
                            Spacer()
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(prob.direction == .improving ? Color.green : Color.blue)
                                    .frame(width: 8, height: 8)
                                Text(prob.direction.rawValue.uppercased())
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }

                        HStack(alignment: .center, spacing: 20) {
                            ZStack {
                                Circle()
                                    .stroke(Color.white.opacity(0.1), lineWidth: 4)
                                    .frame(width: 80, height: 80)
                                Circle()
                                    .trim(from: 0, to: CGFloat(prob.probability))
                                    .stroke(
                                        LinearGradient(colors: [.cyan, .blue], startPoint: .top, endPoint: .bottom),
                                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                                    )
                                    .frame(width: 80, height: 80)
                                    .rotationEffect(.degrees(-90))

                                Text("\(Int(prob.probability * 100))%")
                                    .font(.system(size: 20, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(prob.summary)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.white)
                                    .lineLimit(3)

                                Text("Confidence: \(Int(prob.confidence * 100))%")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white.opacity(0.4))
                            }
                        }
                    }
                    .padding(20)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(24)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
                }

                // 2. Timeline (The deterministic engine)
                VStack(alignment: .leading, spacing: 16) {
                    Text("COACHING TIMELINE")
                        .font(.system(size: 12, weight: .black))
                        .tracking(2)
                        .foregroundColor(.cyan)

                    VStack(spacing: 0) {
                        ForEach(Array(timeline.enumerated()), id: \.offset) { index, event in
                            TimelineRow(event: event, isLast: index == timeline.count - 1)
                        }
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .cornerRadius(24)

                // 3. Weekly Volume / Training Calendar
                VStack(alignment: .leading, spacing: 16) {
                    Text("WEEKLY ACTIVITY")
                        .font(.system(size: 12, weight: .black))
                        .tracking(2)
                        .foregroundColor(.cyan)

                    HStack(alignment: .bottom, spacing: 8) {
                        ForEach(last7Days(), id: \.self) { date in
                            let hasRun = runs.contains { Calendar.current.isDate($0.date, inSameDayAs: date) }
                            VStack(spacing: 8) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(hasRun ? Color.cyan : Color.white.opacity(0.1))
                                    .frame(height: hasRun ? 40 : 10)
                                Text(dayInitial(for: date))
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.4))
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .cornerRadius(24)
            }
            .padding()
        }
        .background(Color(white: 0.05).ignoresSafeArea())
        .onAppear {
            refreshCoaching()
        }
        .onChange(of: runs) { _, _ in
            refreshCoaching()
        }
    }

    private func refreshCoaching() {
        let profile = profiles.first
        timeline = CoachingLogicService.shared.computeTimeline(runs: runs, profile: profile)
        probability = CoachingLogicService.shared.computeGoalProbability(runs: runs, profile: profile)
    }

    private func last7Days() -> [Date] {
        var dates: [Date] = []
        let cal = Calendar.current
        for i in (0...6).reversed() {
            if let date = cal.date(byAdding: .day, value: -i, to: Date()) {
                dates.append(date)
            }
        }
        return dates
    }

    private func dayInitial(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "E"
        return String(formatter.string(from: date).prefix(1))
    }
}

struct TimelineRow: View {
    let event: TimelineEvent
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(spacing: 0) {
                Circle()
                    .fill(Color.cyan)
                    .frame(width: 10, height: 10)
                if !isLast {
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(event.title)
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(.white)
                    Spacer()
                    Text("+\(event.dayOffset)d")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.cyan)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.cyan.opacity(0.1))
                        .cornerRadius(4)
                }

                Text(event.detail)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.6))
                    .lineLimit(2)

                if !isLast {
                    Spacer().frame(height: 16)
                }
            }
        }
        .frame(minHeight: 60)
    }
}
