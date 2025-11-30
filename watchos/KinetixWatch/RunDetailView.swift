import SwiftUI
import SwiftData
import MapKit

struct RunDetailView: View {
    let run: Run
    let unitSystem: String
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header: Date & Time
                VStack(spacing: 2) {
                    Text(run.date.formatted(date: .long, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.gray)
                    Text("NPI \(Int(run.avgNPI))")
                        .font(.system(size: 32, weight: .black, design: .rounded))
                        .foregroundColor(.cyan)
                }
                
                Divider()
                
                // Key Stats Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    DetailStatBox(title: "DISTANCE", value: formattedDistance(run.distance), unit: unitSystem == "metric" ? "km" : "mi", color: .purple)
                    DetailStatBox(title: "DURATION", value: formattedDuration(run.duration), unit: "", color: .orange)
                    DetailStatBox(title: "AVG PACE", value: formattedPace(run.avgPace), unit: "/km", color: .blue)
                    DetailStatBox(title: "AVG HR", value: "\(Int(run.avgHeartRate))", unit: "bpm", color: .red)
                }
                
                // Route Map
                if !run.routeData.isEmpty {
                    Map {
                        MapPolyline(coordinates: run.routeData.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon) })
                            .stroke(.cyan, lineWidth: 4)
                    }
                    .frame(height: 150)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                } else {
                    // Placeholder if no GPS data
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 120)
                        
                        VStack {
                            Image(systemName: "location.slash.fill")
                                .font(.title)
                                .foregroundColor(.gray)
                            Text("No Map Data")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Run Details")
    }
    
    private func formattedDistance(_ meters: Double) -> String {
        let dist = unitSystem == "metric" ? meters/1000 : (meters/1000) * 0.621371
        return String(format: "%.2f", dist)
    }
    
    private func formattedDuration(_ seconds: TimeInterval) -> String {
        let m = Int(seconds / 60)
        let s = Int(seconds.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
    
    private func formattedPace(_ secondsPerKm: Double) -> String {
        let pace = unitSystem == "metric" ? secondsPerKm : secondsPerKm * 1.60934
        if pace.isInfinite || pace.isNaN { return "-:--" }
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
}

struct DetailStatBox: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.gray)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundColor(color)
                Text(unit)
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}
