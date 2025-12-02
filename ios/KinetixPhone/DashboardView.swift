import SwiftUI
import Charts

struct DashboardView: View {
    @StateObject private var connectivity = ConnectivityManager.shared
    @StateObject private var coach = ConversationalCoach()
    @State private var userTextInput = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // 1. LIVE METRICS HEADER
            VStack(spacing: 12) {
                HStack {
                    MetricCard(title: "HR", value: "\(Int(connectivity.currentMetrics.heartRate ?? 0))", unit: "bpm", color: .red)
                    MetricCard(title: "CADENCE", value: "\(Int(connectivity.currentMetrics.cadence ?? 0))", unit: "spm", color: .blue)
                    MetricCard(title: "BOUNCE", value: String(format: "%.1f", connectivity.currentMetrics.verticalOscillation ?? 0), unit: "cm", color: .purple)
                }
                
                if !connectivity.cadenceHistory.isEmpty {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Live Cadence").font(.caption).bold().foregroundColor(.gray)
                            Chart {
                                ForEach(connectivity.cadenceHistory, id: \.0) { item in
                                    LineMark(x: .value("Time", item.0), y: .value("SPM", item.1))
                                        .foregroundStyle(Color.blue.gradient)
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            .chartYScale(domain: 150...200)
                            .chartXAxis(.hidden)
                            .frame(height: 60)
                        }
                        
                        VStack(alignment: .leading) {
                            Text("Live HR").font(.caption).bold().foregroundColor(.gray)
                            Chart {
                                ForEach(connectivity.heartRateHistory, id: \.0) { item in
                                    LineMark(x: .value("Time", item.0), y: .value("BPM", item.1))
                                        .foregroundStyle(Color.red.gradient)
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            .chartYScale(domain: 100...190)
                            .chartXAxis(.hidden)
                            .frame(height: 60)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding()
            .background(Color(UIColor.systemBackground))
            .shadow(radius: 2)
            
            // 2. CONVERSATION STREAM
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(coach.conversationHistory) { msg in
                            ChatBubble(message: msg)
                        }
                        
                        // Spacer for keyboard
                        Color.clear.frame(height: 20)
                    }
                    .padding()
                }
                .onChange(of: coach.conversationHistory.count) { _, _ in
                    if let lastId = coach.conversationHistory.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }
            
            // 3. INPUT AREA (Voice/Text)
            HStack {
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
                            .frame(width: 24, height: 24)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                }
                .disabled(userTextInput.isEmpty || coach.isSpeaking)
                
                // Simulated Voice Button
                Button(action: {
                    // In real app, this triggers VAD/Whisper
                    coach.sendUserMessage("How is my form looking right now?")
                }) {
                    Image(systemName: "mic.circle.fill")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                }
            }
            .padding()
            .background(Color(UIColor.secondarySystemBackground))
        }
        .onAppear {
            connectivity.setupSession()
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack {
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.gray)
            Text(value)
                .font(.title)
                .fontWeight(.heavy)
                .foregroundColor(color)
            Text(unit)
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(10)
    }
}

struct ChatBubble: View {
    let message: ConversationalCoach.ChatMessage
    
    var body: some View {
        HStack {
            if message.sender == .user { Spacer() }
            
            Text(message.text)
                .padding()
                .background(message.sender == .user ? Color.blue : Color(UIColor.secondarySystemBackground))
                .foregroundColor(message.sender == .user ? .white : .primary)
                .cornerRadius(16)
                .frame(maxWidth: 280, alignment: message.sender == .user ? .trailing : .leading)
            
            if message.sender == .coach { Spacer() }
        }
    }
}
