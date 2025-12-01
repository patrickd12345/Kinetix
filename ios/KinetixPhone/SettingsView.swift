import SwiftUI
import SwiftData
import UIKit

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Query private var profiles: [RunnerProfile]
    
    @State private var weightText: String = ""
    @State private var birthDate: Date = Date()
    @State private var sex: String = "unspecified"
    
    @State private var npiDistance: String = ""
    @State private var npiMinutes: String = ""
    @State private var npiSeconds: String = ""
    @State private var npiDate: Date = Date()
    @State private var npiResult: Double?
    
    @State private var aiSummary: String?
    @State private var summaryError: String?
    
    @State private var logExportText: String = ""
    @State private var showingLogExport = false
    
    private let sexOptions = ["unspecified", "female", "male", "nonbinary"]
    
    var body: some View {
        NavigationStack {
            List {
                profileSection
                findMyNPISection
                aiSummarySection
                trainingDistributionSection
                diagnosticsSection
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingLogExport) {
                NavigationStack {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Diagnostic Log")
                            .font(.headline)
                        ScrollView {
                            Text(logExportText)
                                .font(.system(size: 12, weight: .regular, design: .monospaced))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(8)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(8)
                        Button("Copy to Clipboard") {
                            UIPasteboard.general.string = logExportText
                        }
                        Spacer()
                    }
                    .padding()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close") { showingLogExport = false }
                        }
                    }
                }
            }
            .onAppear {
                bootstrapProfile()
            }
        }
    }
    
    // MARK: - Sections
    private var profileSection: some View {
        Section {
            TextField("Weight (kg)", text: $weightText)
                .keyboardType(.decimalPad)
            DatePicker("Date of Birth", selection: $birthDate, displayedComponents: .date)
            Picker("Sex", selection: $sex) {
                ForEach(sexOptions, id: \.self) { option in
                    Text(option.capitalized).tag(option)
                }
            }
            Button("Save Profile") {
                saveProfile()
            }
        } header: {
            Text("Runner Profile")
        } footer: {
            Text("Used for AI summaries, training distribution, and future pace/power estimates.")
        }
    }
    
    private var findMyNPISection: some View {
        Section {
            HStack {
                TextField("Distance km", text: $npiDistance)
                    .keyboardType(.decimalPad)
                TextField("Min", text: $npiMinutes)
                    .frame(width: 50)
                    .keyboardType(.numberPad)
                TextField("Sec", text: $npiSeconds)
                    .frame(width: 50)
                    .keyboardType(.numberPad)
            }
            DatePicker("Date", selection: $npiDate, displayedComponents: .date)
            Button("Add to Log") {
                addManualRun()
            }
            if let npiResult {
                Text("Computed NPI \(Int(npiResult)) added to history")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        } header: {
            Text("Find My NPI")
        } footer: {
            Text("Creates a manual workout entry tagged as imported. Great for race results or treadmill sessions.")
        }
    }
    
    private var aiSummarySection: some View {
        Section(header: Text("AI Training Summary")) {
            Button("Generate Summary (last 6 weeks)") {
                generateAISummary()
            }
            if let summaryError {
                Text(summaryError)
                    .foregroundColor(.red)
                    .font(.caption)
            }
            if let aiSummary {
                Text(aiSummary)
                    .font(.body)
                    .foregroundColor(.primary)
            }
        }
    }
    
    private var trainingDistributionSection: some View {
        Section {
            TrainingDistributionView(runs: recentRuns, profile: profiles.first)
                .frame(height: 200)
        } header: {
            Text("Training Distribution")
        } footer: {
            Text("Speed/Strength, Endurance, and Stability axes reflect the last 6 weeks of sessions.")
        }
    }
    
    private var diagnosticsSection: some View {
        Section {
            Button("Export Log") {
                logExportText = DiagnosticLogManager.shared.exportLogs()
                showingLogExport = true
            }
            Button("Clear Log", role: .destructive) {
                DiagnosticLogManager.shared.clear()
            }
        } header: {
            Text("Diagnostics")
        } footer: {
            Text("Sync errors, audio issues, and runtime notes are captured here.")
        }
    }
    
    // MARK: - Helpers
    private var recentRuns: [Run] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -42, to: Date()) ?? Date()
        return runs.filter { $0.date >= cutoff }
    }
    
    private func bootstrapProfile() {
        guard let profile = profiles.first else {
            let newProfile = RunnerProfile()
            modelContext.insert(newProfile)
            weightText = String(format: "%.1f", newProfile.weightKg)
            birthDate = newProfile.dateOfBirth
            sex = newProfile.sex
            return
        }
        weightText = String(format: "%.1f", profile.weightKg)
        birthDate = profile.dateOfBirth
        sex = profile.sex
    }
    
    private func saveProfile() {
        let profile = profiles.first ?? RunnerProfile()
        profile.weightKg = Double(weightText) ?? profile.weightKg
        profile.dateOfBirth = birthDate
        profile.sex = sex
        if profiles.isEmpty {
            modelContext.insert(profile)
        }
    }
    
    private func addManualRun() {
        guard let distanceKm = Double(npiDistance), distanceKm > 0 else { return }
        let minutes = Double(npiMinutes) ?? 0
        let seconds = Double(npiSeconds) ?? 0
        let duration = (minutes * 60) + seconds
        guard duration > 0 else { return }
        let distanceMeters = distanceKm * 1000
        let pace = duration / (distanceMeters / 1000)
        let npi = computeNPI(distanceMeters: distanceMeters, durationSeconds: duration)
        let run = Run(
            date: npiDate,
            source: "manual",
            distance: distanceMeters,
            duration: duration,
            avgPace: pace,
            avgNPI: npi,
            avgHeartRate: 0
        )
        modelContext.insert(run)
        npiResult = npi
    }
    
    private func computeNPI(distanceMeters: Double, durationSeconds: Double) -> Double {
        guard distanceMeters > 0, durationSeconds > 0 else { return 0 }
        let paceSeconds = durationSeconds / (distanceMeters / 1000.0)
        let speedKmH = (1000 / paceSeconds) * 3.6
        let factor = pow(distanceMeters / 1000.0, 0.06)
        return speedKmH * factor * 10.0
    }
    
    private func generateAISummary() {
        guard !recentRuns.isEmpty else {
            summaryError = "Not enough workouts to summarize."
            return
        }
        summaryError = nil
        let totalDistance = recentRuns.map(\.distance).reduce(0, +) / 1000
        let avgNPI = recentRuns.map(\.avgNPI).reduce(0, +) / Double(recentRuns.count)
        let bestNPI = recentRuns.map(\.avgNPI).max() ?? avgNPI
        let stabilityScore = recentRuns.compactMap { $0.formScore }.averageOrNil() ?? 0
        let cadence = recentRuns.compactMap { $0.avgCadence }.averageOrNil() ?? 0
        
        let summary = """
        Past \(recentRuns.count) workouts: \(String(format: "%.1f", totalDistance)) km total.
        Avg NPI \(Int(avgNPI)), best \(Int(bestNPI)).
        Stability \(Int(stabilityScore)) / cadence \(Int(cadence)) spm.
        Focus on smoother ground contact and even strides. Recovery days every 3rd run.
        """
        aiSummary = summary
    }
}

private extension Array where Element == Double {
    func averageOrNil() -> Double? {
        guard !isEmpty else { return nil }
        return reduce(0, +) / Double(count)
    }
}
