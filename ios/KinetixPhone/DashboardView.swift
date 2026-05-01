import SwiftUI
import Charts

struct DashboardView: View {
    @StateObject private var connectivity = ConnectivityManager.shared
    @StateObject private var coach = ConversationalCoach()
    @State private var userTextInput = ""
    @State private var activeSubTab = 0 // 0: Live, 1: Coaching
    
    var body: some View {
        VStack(spacing: 0) {
            // Segmented Picker for Live vs Coaching
            Picker("Dashboard Mode", selection: $activeSubTab) {
                Text("Live").tag(0)
                Text("Coaching").tag(1)
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(white: 0.05))

            if activeSubTab == 0 {
                liveView
            } else {
                CoachingDashboardView()
            }
        }
        .onAppear {
            connectivity.setupSession()
        }
    }

    private var liveView: some View {
        VStack(spacing: 0) {
            // 1. LIVE METRICS HEADER
            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    MetricCard(title: "HR", value: "\(Int(connectivity.currentMetrics.heartRate ?? 0))", unit: "bpm", color: .red)
                    MetricCard(title: "CADENCE", value: "\(Int(connectivity.currentMetrics.cadence ?? 0))", unit: "spm", color: .blue)
                    MetricCard(title: "BOUNCE", value: String(format: "%.1f", connectivity.currentMetrics.verticalOscillation ?? 0), unit: "cm", color: .purple)
                }
                
                if !connectivity.cadenceHistory.isEmpty {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Live Cadence").font(.caption2).bold().foregroundColor(.gray)
                            Chart {
                                ForEach(connectivity.cadenceHistory, id: \.0) { item in
                                    LineMark(x: .value("Time", item.0), y: .value("SPM", item.1))
                                        .foregroundStyle(Color.blue.gradient)
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            .chartYScale(domain: 150...200)
                            .chartXAxis(.hidden)
                            .frame(height: 48)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Live HR").font(.caption2).bold().foregroundColor(.gray)
                            Chart {
                                ForEach(connectivity.heartRateHistory, id: \.0) { item in
                                    LineMark(x: .value("Time", item.0), y: .value("BPM", item.1))
                                        .foregroundStyle(Color.red.gradient)
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            .chartYScale(domain: 100...190)
                            .chartXAxis(.hidden)
                            .frame(height: 48)
                        }
                    }
                    .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(Color(white: 0.08))
            .shadow(radius: 2)
            
            // 2. CONVERSATION STREAM
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if coach.conversationHistory.isEmpty {
                            Text("Messages appear here.")
                                .font(.footnote)
                                .foregroundColor(.gray.opacity(0.75))
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .padding(.horizontal, 20)
                        }
                        ForEach(coach.conversationHistory) { msg in
                            ChatBubble(message: msg)
                        }
                        Color.clear.frame(height: 12)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .onChange(of: coach.conversationHistory.count) { _, _ in
                    if let lastId = coach.conversationHistory.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }
            .background(Color(white: 0.05))
            
            // 3. INPUT AREA
            HStack(spacing: 10) {
                TextField("Ask Coach...", text: $userTextInput)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Button(action: {
                    if !userTextInput.isEmpty {
                        coach.sendUserMessage(userTextInput)
                        userTextInput = ""
                    }
                }) {
                    if coach.isSpeaking {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                }
                .disabled(userTextInput.isEmpty || coach.isSpeaking)
                
                Button(action: {
                    coach.sendUserMessage("How is my form looking right now?")
                }) {
                    Image(systemName: "mic.circle.fill")
                        .font(.title)
                        .foregroundColor(.red)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(white: 0.12))
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.caption2)
                .fontWeight(.bold)
                .foregroundColor(.gray)
            Text(value)
                .font(.title2)
                .fontWeight(.heavy)
                .foregroundColor(color)
            Text(unit)
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
        .background(Color.white.opacity(0.05))
        .cornerRadius(10)
    }
}

struct ChatBubble: View {
    let message: ConversationalCoach.ChatMessage
    
    var body: some View {
        HStack {
            if message.sender == .user { Spacer() }
            
            Text(message.text)
                .font(.subheadline)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(message.sender == .user ? Color.blue : Color.white.opacity(0.1))
                .foregroundColor(.white)
                .cornerRadius(14)
                .frame(maxWidth: 280, alignment: message.sender == .user ? .trailing : .leading)
            
            if message.sender == .coach { Spacer() }
        }
    }
}
