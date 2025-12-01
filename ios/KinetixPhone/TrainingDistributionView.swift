import SwiftUI

struct TrainingDistributionView: View {
    let runs: [Run]
    let profile: RunnerProfile?
    
    private var axes: (speed: Double, endurance: Double, stability: Double) {
        let totalDistance = runs.map(\.distance).reduce(0, +) / 1000
        let avgNPI = runs.map(\.avgNPI).reduce(0, +) / Double(max(1, runs.count))
        let stabilityRaw = runs.compactMap { $0.formScore }.reduce(0, +) / Double(max(1, runs.compactMap { $0.formScore }.count))
        let cadence = runs.compactMap { $0.avgCadence }.reduce(0, +) / Double(max(1, runs.compactMap { $0.avgCadence }.count))
        
        let speedStrength = min(1.0, avgNPI / 180.0)
        let endurance = min(1.0, totalDistance / 50.0) // 50km over window ~ full endurance
        let stability = min(1.0, (stabilityRaw / 160.0) + (cadence / 220.0) * 0.3)
        return (speedStrength, endurance, stability)
    }
    
    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height * 0.55)
            let radius = size / 2.2
            
            ZStack {
                // Triangle base
                Triangle()
                    .strokeBorder(Color.gray.opacity(0.3), lineWidth: 1)
                    .frame(width: radius * 1.8, height: radius * 1.5)
                    .position(center)
                
                // Axes labels
                VStack {
                    Text("Speed / Strength").font(.caption2).foregroundColor(.cyan)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                
                Text("Endurance")
                    .font(.caption2)
                    .foregroundColor(.green)
                    .position(x: center.x - radius * 0.9, y: center.y + radius * 0.7)
                
                Text("Stability")
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .position(x: center.x + radius * 0.9, y: center.y + radius * 0.7)
                
                // Ball
                Circle()
                    .fill(LinearGradient(colors: [.cyan, .green, .orange], startPoint: .top, endPoint: .bottom))
                    .frame(width: 18, height: 18)
                    .shadow(color: .cyan.opacity(0.4), radius: 6, x: 0, y: 3)
                    .position(ballPosition(center: center, radius: radius))
            }
        }
    }
    
    private func ballPosition(center: CGPoint, radius: CGFloat) -> CGPoint {
        // Convert barycentric values to 2D within triangle
        let speed = axes.speed
        let endurance = axes.endurance
        let stability = axes.stability
        
        let top = CGPoint(x: center.x, y: center.y - radius)
        let left = CGPoint(x: center.x - radius, y: center.y + radius * 0.8)
        let right = CGPoint(x: center.x + radius, y: center.y + radius * 0.8)
        
        let total = max(0.001, speed + endurance + stability)
        let s = speed / total
        let e = endurance / total
        let st = stability / total
        
        let x = s * top.x + e * left.x + st * right.x
        let y = s * top.y + e * left.y + st * right.y
        return CGPoint(x: x, y: y)
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}
