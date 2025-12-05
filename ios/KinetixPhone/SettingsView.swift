import SwiftUI
import SwiftData
import UIKit

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Query private var profiles: [RunnerProfile]
    @Query(sort: [SortDescriptor<CustomBatteryProfile>(\.name)]) private var batteryProfiles: [CustomBatteryProfile]
    
    @State private var weightText: String = ""
    @State private var birthDate: Date = Date()
    @State private var sex: String = "unspecified"
    @State private var targetNPIText: String = "135"
    
    @State private var npiDistance: String = ""
    @State private var npiMinutes: String = ""
    @State private var npiSeconds: String = ""
    @State private var npiDate: Date = Date()
    @State private var npiResult: Double?
    
    @State private var aiSummary: String?
    @State private var summaryError: String?
    
    @State private var logExportText: String = ""
    @State private var showingLogExport = false
    
    @State private var showingProfileEditor = false
    @State private var editingProfile: CustomBatteryProfile?
    
    @State private var showingSaveConfirmation = false
    @State private var saveConfirmationMessage = ""
    
    @State private var cloudSyncStatus: SyncStatus?
    @State private var isSyncing = false
    @State private var showingCloudAuth = false
    
    @State private var ollamaURL: String = "http://localhost:11434"
    @State private var ollamaModel: String = "llama3.2"
    @State private var ollamaAvailable: Bool = false
    @State private var checkingOllama = false
    @State private var showAdvancedAISettings = false
    @State private var geminiApiKey: String = ""
    @State private var showingApiKeySaved = false
    
    private let sexOptions = ["unspecified", "female", "male", "nonbinary"]
    
    var body: some View {
        NavigationStack {
            List {
                profileSection
                cloudStorageSection
                aiSettingsSection
                batteryProfileSection
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
                updateCloudSyncStatus()
                loadOllamaSettings()
                loadGeminiApiKey()
                checkOllamaAvailability()
            }
            .sheet(isPresented: $showingCloudAuth) {
                // OAuth will be handled by CloudSyncService
            }
            .sheet(isPresented: $showingProfileEditor) {
                BatteryProfileEditorView(profile: editingProfile, onSave: { profileName in
                    saveConfirmationMessage = "Battery profile \"\(profileName)\" saved successfully"
                    showingSaveConfirmation = true
                })
            }
            .alert("Saved", isPresented: $showingSaveConfirmation) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(saveConfirmationMessage)
            }
        }
    }
    
    // MARK: - Sections
    private var cloudStorageSection: some View {
        Section {
            if let status = cloudSyncStatus {
                if status.isConnected {
                    HStack {
                        Label("Connected", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Spacer()
                        Text(status.provider?.capitalized ?? "Unknown")
                            .foregroundColor(.secondary)
                    }
                    
                    if let lastSync = status.lastSyncTime {
                        HStack {
                            Label("Last Sync", systemImage: "clock")
                            Spacer()
                            Text(lastSync, style: .relative)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Button {
                        Task {
                            await syncNow()
                        }
                    } label: {
                        HStack {
                            if isSyncing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Label("Sync Now", systemImage: "arrow.clockwise")
                            }
                        }
                    }
                    .disabled(isSyncing)
                    
                    Button(role: .destructive) {
                        UnifiedStorageService.shared.disableCloudSync()
                        cloudSyncStatus = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            updateCloudSyncStatus()
                        }
                    } label: {
                        Label("Disconnect", systemImage: "xmark.circle")
                    }
                } else {
                    Button {
                        Task {
                            await connectCloudStorage()
                        }
                    } label: {
                        HStack {
                            if isSyncing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Label("Connect Google Drive", systemImage: "cloud")
                            }
                        }
                    }
                    .disabled(isSyncing)
                }
            } else {
                Button {
                    Task {
                        await connectCloudStorage()
                    }
                } label: {
                    HStack {
                        if isSyncing {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Label("Connect Google Drive", systemImage: "cloud")
                        }
                    }
                }
                .disabled(isSyncing)
            }
        } header: {
            Text("Cloud Storage")
        } footer: {
            Text("Sync your runs to Google Drive for backup and cross-device access.")
        }
    }
    
    private var aiSettingsSection: some View {
        Section {
            // AI Status Summary
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("AI Analysis")
                        .font(.headline)
                    Text(aiStatusDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding(.vertical, 4)
            
            // Advanced Settings (collapsed by default)
            if showAdvancedAISettings {
                Divider()
                
                // Gemini API Key (Bring Your Own AI)
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Gemini API Key")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            if ApiKeyStorage.shared.hasKey(name: "gemini_api_key") {
                                Label("Saved", systemImage: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            } else {
                                Text("Free • No credit card required")
                                    .font(.caption2)
                                    .foregroundColor(.blue)
                            }
                        }
                        Spacer()
                    }
                    
                    if ApiKeyStorage.shared.hasKey(name: "gemini_api_key") {
                        HStack {
                            Text("••••••••••••••••")
                                .foregroundColor(.secondary)
                            Spacer()
                            Button("Clear") {
                                geminiApiKey = ""
                                saveGeminiApiKey("")
                            }
                            .font(.caption)
                            .foregroundColor(.red)
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(8)
                    } else {
                        // Step-by-step guide
                        VStack(alignment: .leading, spacing: 8) {
                            Button {
                                if let url = URL(string: "https://aistudio.google.com/apikey") {
                                    UIApplication.shared.open(url)
                                }
                            } label: {
                                HStack {
                                    Label("Get Free API Key", systemImage: "arrow.up.right.square")
                                        .font(.subheadline)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .top, spacing: 8) {
                                    Text("1.")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("Tap above to open Google AI Studio")
                                        .font(.caption)
                                }
                                HStack(alignment: .top, spacing: 8) {
                                    Text("2.")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("Sign in with your Google account")
                                        .font(.caption)
                                }
                                HStack(alignment: .top, spacing: 8) {
                                    Text("3.")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("Click 'Create API Key' → Copy the key")
                                        .font(.caption)
                                }
                                HStack(alignment: .top, spacing: 8) {
                                    Text("4.")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("Paste it below")
                                        .font(.caption)
                                }
                            }
                            .padding(.leading, 8)
                            .foregroundColor(.secondary)
                            
                            SecureField("Paste your API key here", text: $geminiApiKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .padding()
                                .background(Color(UIColor.secondarySystemBackground))
                                .cornerRadius(8)
                                .onChange(of: geminiApiKey) { oldValue, newValue in
                                    // Auto-save when user pastes a valid-looking key (Gemini keys are typically 39 chars)
                                    if !newValue.isEmpty && newValue.count >= 20 && newValue != oldValue {
                                        saveGeminiApiKey(newValue)
                                        // Show success feedback
                                        withAnimation {
                                            showingApiKeySaved = true
                                        }
                                        // Auto-hide after 3 seconds
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                                            withAnimation {
                                                showingApiKeySaved = false
                                            }
                                        }
                                    }
                                }
                            
                            if showingApiKeySaved {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                    Text("API key saved! AI analysis enabled.")
                                        .font(.caption)
                                        .foregroundColor(.green)
                                }
                                .padding(.top, 4)
                                .transition(.opacity.combined(with: .scale))
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
                
                Divider()
                
                // Ollama Settings
                HStack {
                    Label("Ollama Status", systemImage: "brain")
                    Spacer()
                    if checkingOllama {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(ollamaAvailable ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text(ollamaAvailable ? "Available" : "Unavailable")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                TextField("Ollama URL", text: $ollamaURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .onChange(of: ollamaURL) { _, newValue in
                        UserDefaults.standard.set(newValue, forKey: "ollama_api_url")
                        checkOllamaAvailability()
                    }
                
                TextField("Model", text: $ollamaModel)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .onChange(of: ollamaModel) { _, newValue in
                        UserDefaults.standard.set(newValue, forKey: "ollama_model")
                    }
                
                Button {
                    checkOllamaAvailability()
                } label: {
                    Label("Check Connection", systemImage: "arrow.clockwise")
                }
            }
            
            Button {
                withAnimation {
                    showAdvancedAISettings.toggle()
                }
            } label: {
                Label(showAdvancedAISettings ? "Hide Advanced Settings" : "Show Advanced Settings", 
                      systemImage: showAdvancedAISettings ? "chevron.up" : "chevron.down")
                    .font(.caption)
            }
        } header: {
            Text("AI Coach")
        } footer: {
            Text("AI analysis works automatically. Ollama (local AI) is optional - the app uses Gemini or rule-based analysis if Ollama isn't available.")
        }
    }
    
    private var aiStatusDescription: String {
        let geminiKey = Bundle.main.object(forInfoDictionaryKey: "GEMINI_API_KEY") as? String ?? ""
        if ollamaAvailable {
            return "Using local AI (Ollama)"
        } else if !geminiKey.isEmpty && !geminiKey.contains("PASTE") {
            return "Using Gemini AI"
        } else {
            return "Using rule-based analysis"
        }
    }
    
    private var batteryProfileSection: some View {
        Section {
            ForEach(batteryProfiles) { profile in
                NavigationLink {
                    BatteryProfileEditorView(profile: profile, onSave: { profileName in
                        saveConfirmationMessage = "Battery profile \"\(profileName)\" saved successfully"
                        showingSaveConfirmation = true
                    })
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(profile.name)
                            .font(.headline)
                        Text("GPS: \(Int(profile.gpsInterval))s • Motion: \(Int(profile.motionSensorInterval))s • Form: \(Int(profile.formAnalysisInterval))s")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        HStack(spacing: 8) {
                            if profile.allowHaptics {
                                Label("Haptics", systemImage: "hand.tap")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            if profile.allowVoice {
                                Label("Voice", systemImage: "speaker.wave.2")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            if profile.allowLiveCharts {
                                Label("Charts", systemImage: "chart.line.uptrend.xyaxis")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            
            Button {
                editingProfile = nil
                showingProfileEditor = true
            } label: {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("New Battery Profile")
                }
                .foregroundColor(.blue)
            }
        } header: {
            Text("Watch Battery Profiles")
        } footer: {
            Text("Custom battery profiles let you fine-tune GPS sampling, sensor intervals, and features to optimize battery life for your specific needs. Profiles sync automatically to your Watch.")
        }
    }
    
    private var profileSection: some View {
        Section {
            HStack {
                Text("Weight (kg)")
                    .frame(width: 120, alignment: .leading)
                TextField("Weight", text: $weightText)
                    .keyboardType(.decimalPad)
            }
            DatePicker("Date of Birth", selection: $birthDate, displayedComponents: .date)
            Picker("Sex", selection: $sex) {
                ForEach(sexOptions, id: \.self) { option in
                    Text(option.capitalized).tag(option)
                }
            }
            HStack {
                Text("Target NPI")
                    .frame(width: 120, alignment: .leading)
                TextField("Target NPI", text: $targetNPIText)
                    .keyboardType(.decimalPad)
            }
            Button("Save Profile") {
                saveProfile()
            }
        } header: {
            Text("Runner Profile")
        } footer: {
            Text("Used for AI summaries, training distribution, and future pace/power estimates. Target NPI is used for AI analysis comparisons.")
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
            targetNPIText = String(format: "%.0f", newProfile.targetNPI)
            return
        }
        weightText = String(format: "%.1f", profile.weightKg)
        birthDate = profile.dateOfBirth
        sex = profile.sex
        targetNPIText = String(format: "%.0f", profile.targetNPI)
    }
    
    private func saveProfile() {
        let profile = profiles.first ?? RunnerProfile()
        profile.weightKg = Double(weightText) ?? profile.weightKg
        profile.dateOfBirth = birthDate
        profile.sex = sex
        profile.targetNPI = Double(targetNPIText) ?? profile.targetNPI
        if profiles.isEmpty {
            modelContext.insert(profile)
        }
        
        // Show confirmation
        saveConfirmationMessage = "Runner profile saved successfully"
        showingSaveConfirmation = true
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
    
    private func updateCloudSyncStatus() {
        cloudSyncStatus = UnifiedStorageService.shared.getSyncStatus()
    }
    
    private func loadOllamaSettings() {
        ollamaURL = UserDefaults.standard.string(forKey: "ollama_api_url") ?? "http://localhost:11434"
        ollamaModel = UserDefaults.standard.string(forKey: "ollama_model") ?? "llama3.2"
    }
    
    private func loadGeminiApiKey() {
        // Don't load the actual key value (security) - UI will show saved indicator
        geminiApiKey = ""
    }
    
    private func saveGeminiApiKey(_ key: String) {
        do {
            try ApiKeyStorage.shared.storeKey(name: "gemini_api_key", value: key)
            // Clear the field after saving (for security)
            geminiApiKey = ""
        } catch {
            print("Failed to save Gemini API key: \(error)")
        }
    }
    
    private func checkOllamaAvailability() {
        checkingOllama = true
        Task {
            let available = await AICoach.isOllamaAvailable()
            await MainActor.run {
                ollamaAvailable = available
                checkingOllama = false
            }
        }
    }
    
    @State private var presentingViewController: UIViewController?
    
    private func connectCloudStorage() async {
        // Get the root view controller for OAuth
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            saveConfirmationMessage = "Could not find view controller for authentication"
            showingSaveConfirmation = true
            return
        }
        
        isSyncing = true
        defer { isSyncing = false }
        
        do {
            // This automatically opens Google OAuth dialog - let it handle credential errors gracefully
            try await UnifiedStorageService.shared.enableCloudSync(
                presentingViewController: rootViewController,
                modelContext: modelContext
            )
            updateCloudSyncStatus()
            saveConfirmationMessage = "Google Drive connected successfully"
            showingSaveConfirmation = true
        } catch {
            // Show user-friendly error message
            let errorMsg = error.localizedDescription
            if errorMsg.contains("credentials") || errorMsg.contains("GOOGLE_CLIENT") {
                saveConfirmationMessage = "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Info.plist"
            } else {
                saveConfirmationMessage = "Failed to connect: \(errorMsg)"
            }
            showingSaveConfirmation = true
        }
    }
    
    private func syncNow() async {
        isSyncing = true
        defer { isSyncing = false }
        
        do {
            let result = try await UnifiedStorageService.shared.manualSync(modelContext: modelContext)
            updateCloudSyncStatus()
            saveConfirmationMessage = "Sync complete: \(result.uploaded ?? 0) uploaded, \(result.downloaded ?? 0) downloaded"
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Sync failed: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }
}

private extension Array where Element == Double {
    func averageOrNil() -> Double? {
        guard !isEmpty else { return nil }
        return reduce(0, +) / Double(count)
    }
}
