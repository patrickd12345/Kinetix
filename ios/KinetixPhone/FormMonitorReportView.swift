import SwiftUI
import SwiftData
import Charts

struct FormMonitorReportView: View {
    private let sessionId: UUID
    @Query private var samples: [FormMonitorSample]
    @State private var playhead: Int = 0
    
    init(sessionId: UUID) {
        self.sessionId = sessionId
        _samples = Query(
            filter: #Predicate { $0.sessionId == sessionId },
            sort: [SortDescriptor<FormMonitorSample>(\.timestamp, order: .forward)]
        )
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Form Monitor")
                .font(.title2).bold()
            
            if samples.isEmpty {
                ContentUnavailableView("No Form Data", systemImage: "dot.viewfinder", description: Text("This run has no Form Monitor samples yet."))
            } else {
                BubblePlaybackView(samples: samples, playhead: $playhead)
                    .frame(height: 220)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                
                FormHeatmapView(samples: samples)
                    .frame(height: 160)
                
                FormQualityVsPaceView(samples: samples)
                    .frame(height: 180)
                
                SymmetryCurveView(samples: samples)
                    .frame(height: 160)
                
                DriftAnalysisView(samples: samples)
            }
        }
    }
}

private struct BubblePlaybackView: View {
    let samples: [FormMonitorSample]
    @Binding var playhead: Int
    @State private var timer: Timer?
    
    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("Bubble Playback").font(.headline)
                Spacer()
                Text(samples[playhead].timestamp, style: .time)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let radius = min(size.width, size.height) / 2.5
                
                let path = Path { path in
                    for sample in samples {
                        let point = CGPoint(
                            x: center.x + CGFloat(sample.bubbleX) * radius,
                            y: center.y - CGFloat(sample.bubbleY) * radius
                        )
                        if path.isEmpty {
                            path.move(to: point)
                        } else {
                            path.addLine(to: point)
                        }
                    }
                }
                context.stroke(path, with: .color(.gray.opacity(0.3)), lineWidth: 1)
                
                let active = samples[playhead]
                let bubblePoint = CGPoint(
                    x: center.x + CGFloat(active.bubbleX) * radius,
                    y: center.y - CGFloat(active.bubbleY) * radius
                )
                let bubbleSize = 18 + CGFloat(active.instability * 12)
                let bubble = Path(ellipseIn: CGRect(
                    x: bubblePoint.x - bubbleSize / 2,
                    y: bubblePoint.y - bubbleSize / 2,
                    width: bubbleSize,
                    height: bubbleSize
                ))
                let hue = 0.33 * active.symmetry
                context.fill(bubble, with: .color(Color(hue: hue, saturation: 0.9, brightness: 0.95)))
            }
            .onAppear(perform: startTimer)
            .onDisappear { timer?.invalidate() }
            
            Slider(value: Binding(
                get: { Double(playhead) },
                set: { playhead = min(samples.count - 1, max(0, Int($0))) }
            ), in: 0...Double(max(1, samples.count - 1)))
        }
        .padding()
    }
    
    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            playhead = (playhead + 1) % samples.count
        }
    }
}

private struct FormHeatmapView: View {
    let samples: [FormMonitorSample]
    
    var body: some View {
        VStack(alignment: .leading) {
            Text("Form Heatmap").font(.headline)
            Chart(samples, id: \.id) { sample in
                PointMark(
                    x: .value("X", sample.bubbleX),
                    y: .value("Y", sample.bubbleY)
                )
                .foregroundStyle(Color.orange.opacity(sample.instability + 0.2))
                .symbolSize(60 * (sample.instability + 0.2))
            }
            .chartXAxisLabel("Overstride / Stride Drift")
            .chartYAxisLabel("Vertical Deviation")
        }
    }
}

private struct FormQualityVsPaceView: View {
    let samples: [FormMonitorSample]
    
    private var trimmed: [FormMonitorSample] {
        samples.filter { ($0.pace ?? 0) > 0 }
    }
    private var paceBounds: (min: Double, max: Double) {
        let values = trimmed.compactMap { $0.rollingPace ?? $0.pace }.filter { $0 > 0 }
        guard let min = values.min(), let max = values.max() else { return (0, 0) }
        return (min, max)
    }
    
    var body: some View {
        VStack(alignment: .leading) {
            Text("Quality vs Pace").font(.headline)
            Chart {
                ForEach(trimmed, id: \.id) { sample in
                    LineMark(
                        x: .value("Time", sample.timestamp),
                        y: .value("Symmetry", sample.symmetry)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(.green)
                    
                    LineMark(
                        x: .value("Time", sample.timestamp),
                        y: .value("Pace (normalized)", normalizedPace(sample.rollingPace ?? sample.pace ?? 0))
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(.blue.opacity(0.7))
                }
            }
            .chartYAxisLabel("Symmetry / Pace (normalized)")
            .frame(maxHeight: .infinity)
            
            Text("Pace line is normalized between your fastest and slowest minute-per-km during this run for quick comparison against symmetry.")
                .font(.caption)
                .foregroundColor(.gray)
        }
    }
    
    private func normalizedPace(_ pace: Double) -> Double {
        let bounds = paceBounds
        guard bounds.max > bounds.min else { return 0 }
        let clamped = min(bounds.max, max(bounds.min, pace))
        return 1 - ((clamped - bounds.min) / (bounds.max - bounds.min))
    }
}

private struct SymmetryCurveView: View {
    let samples: [FormMonitorSample]
    
    var body: some View {
        VStack(alignment: .leading) {
            Text("Symmetry Curve").font(.headline)
            Chart(samples, id: \.id) { sample in
                LineMark(
                    x: .value("Time", sample.timestamp),
                    y: .value("Symmetry", sample.symmetry)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(.green)
            }
            .chartYScale(domain: 0...1)
        }
    }
}

private struct DriftAnalysisView: View {
    let samples: [FormMonitorSample]
    
    private var meanX: Double {
        samples.map(\.bubbleX).reduce(0, +) / Double(samples.count)
    }
    private var meanY: Double {
        samples.map(\.bubbleY).reduce(0, +) / Double(samples.count)
    }
    private var worstInstability: [FormMonitorSample] {
        Array(samples.sorted { $0.instability > $1.instability }.prefix(3))
    }
    private var collapseMoment: FormMonitorSample? {
        samples.first(where: { $0.symmetry < 0.7 || $0.instability > 0.7 })
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Drift Analysis").font(.headline)
            Text("Bubble bias \(meanX > 0 ? "right" : "left") \(String(format: "%.2f", meanX)), vertical trend \(String(format: "%.2f", meanY)).")
                .font(.body)
            
            if let lowestSym = samples.min(by: { $0.symmetry < $1.symmetry }) {
                Text("Lowest symmetry at \(lowestSym.timestamp.formatted(date: .omitted, time: .shortened)): \(Int(lowestSym.symmetry * 100))%")
                    .font(.caption)
            }
            
            if let collapse = collapseMoment {
                Text("Form started to deteriorate near \(collapse.timestamp.formatted(date: .omitted, time: .shortened)).")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            
            if !worstInstability.isEmpty {
                Text("Key breakdown moments")
                    .font(.subheadline).bold()
                ForEach(worstInstability, id: \.id) { sample in
                    HStack {
                        Text(sample.timestamp, style: .time)
                        Spacer()
                        Text(String(format: "Instability %.0f%%", sample.instability * 100))
                            .foregroundColor(.orange)
                    }
                    .font(.caption)
                }
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
    }
}
