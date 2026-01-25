import SwiftUI

struct FormMonitorPrimaryView: View {
    let state: FormBubbleState
    
    var body: some View {
        VStack(spacing: 8) {
            Text("FORM MONITOR")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(.gray)
            
            GeometryReader { geo in
                let size = min(geo.size.width, geo.size.height)
                let radius = size / 2.5
                
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.4), lineWidth: 6)
                        .frame(width: size * 0.85, height: size * 0.85)
                    
                    Circle()
                        .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                        .foregroundColor(.gray.opacity(0.4))
                        .frame(width: size * 0.6, height: size * 0.6)
                    
                    // Crosshair
                    Path { path in
                        path.move(to: CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.15))
                        path.addLine(to: CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.85))
                        path.move(to: CGPoint(x: geo.size.width * 0.15, y: geo.size.height / 2))
                        path.addLine(to: CGPoint(x: geo.size.width * 0.85, y: geo.size.height / 2))
                    }
                    .stroke(Color.gray.opacity(0.25), lineWidth: 1)
                    
                    // Bubble
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    state.color.opacity(0.9),
                                    state.color.opacity(0.5),
                                    Color.white.opacity(0.1)
                                ],
                                center: .center,
                                startRadius: 2,
                                endRadius: state.size
                            )
                        )
                        .frame(width: state.size, height: state.size)
                        .shadow(color: state.color.opacity(0.4), radius: 8, x: 0, y: 0)
                        .offset(x: CGFloat(state.normalized.x) * radius, y: -CGFloat(state.normalized.y) * radius)
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: state)
                    
                    // Instability ring
                    Circle()
                        .trim(from: 0, to: CGFloat(state.instability))
                        .stroke(
                            AngularGradient(
                                colors: [.orange, .yellow, .red],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 3, lineCap: .round)
                        )
                        .frame(width: size * 0.95, height: size * 0.95)
                        .rotationEffect(.degrees(-90))
                        .opacity(state.instability > 0.05 ? 1 : 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

struct FormMonitorSecondaryMetricsView: View {
    let metrics: FormMetrics
    let state: FormBubbleState
    
    var body: some View {
        VStack(spacing: 6) {
            HStack {
                MetricPill(label: "Symmetry", value: String(format: "%.0f%%", state.symmetry * 100), color: state.color)
                MetricPill(label: "Instability", value: String(format: "%.0f%%", state.instability * 100), color: .orange)
            }
            HStack {
                MetricPill(label: "Cadence", value: "\(Int(metrics.cadence ?? 0)) spm", color: .blue)
                MetricPill(label: "Bounce", value: String(format: "%.1f cm", metrics.verticalOscillation ?? 0), color: .purple)
            }
            HStack {
                MetricPill(label: "Stride", value: String(format: "%.2f m", metrics.strideLength ?? 0), color: .green)
                MetricPill(label: "GCT", value: String(format: "%.0f ms", metrics.groundContactTime ?? 0), color: .yellow)
            }
            if let pace = state.rollingPace, !pace.isNaN, !pace.isInfinite {
                MetricPill(label: "Rolling Pace", value: paceString(pace), color: .cyan)
            }
        }
    }
    
    private func paceString(_ pace: Double) -> String {
        let min = Int(pace / 60)
        let sec = Int(pace.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", min, sec)
    }
}

struct MetricPill: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(.gray)
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
        .padding(6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.black.opacity(0.25))
        .cornerRadius(8)
    }
}

struct FormMonitorPaceView: View {
    let metrics: FormMetrics
    let state: FormBubbleState
    let distance: Double
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Rolling Pace")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.gray)
                    Text(paceString(metrics.pace ?? 0))
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundStyle(.cyan)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("Distance")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.gray)
                    Text(String(format: "%.2f km", distance / 1000))
                        .font(.system(size: 18, weight: .semibold))
                }
            }
            
            HStack {
                MetricPill(label: "Symmetry", value: String(format: "%.0f%%", state.symmetry * 100), color: state.color)
                MetricPill(label: "Instability", value: String(format: "%.0f%%", state.instability * 100), color: .orange)
            }
        }
        .padding(.horizontal, 8)
    }
    
    private func paceString(_ pace: Double) -> String {
        guard pace.isFinite else { return "-:--" }
        let min = Int(pace / 60)
        let sec = Int(pace.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", min, sec)
    }
}

struct FormMonitorNPIView: View {
    let npi: Double
    let symmetry: Double
    let instability: Double
    
    var body: some View {
        VStack(spacing: 10) {
            Text("Form Quality")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.gray)
            Text(String(format: "%.0f", npi))
                .font(.system(size: 46, weight: .black, design: .rounded))
                .italic()
                .foregroundStyle(npi >= 130 ? .green : .cyan)
            
            HStack {
                MetricPill(label: "Sym", value: String(format: "%.0f%%", symmetry * 100), color: .green)
                MetricPill(label: "Stab", value: String(format: "%.0f%%", (1 - instability) * 100), color: .orange)
            }
        }
    }
}
