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
    
    @State private var isStravaConnected = false
    @State private var stravaExporting = false
    @State private var showingStravaExport = false
    @State private var stravaDays = 90
    
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
                stravaSection
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
    
    private var stravaSection: some View {
        Section {
            if isStravaConnected {
                HStack {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Spacer()
                    Text("Strava")
                        .foregroundColor(.secondary)
                }
                
                Button {
                    showingStravaExport = true
                } label: {
                    HStack {
                        if stravaExporting {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Label("Export to Google Drive", systemImage: "square.and.arrow.up")
                        }
                    }
                }
                .disabled(stravaExporting)
                
                Button(role: .destructive) {
                    disconnectStrava()
                } label: {
                    Label("Disconnect", systemImage: "xmark.circle")
                }
            } else {
                Button {
                    connectStrava()
                } label: {
                    Label("Connect Strava", systemImage: "figure.run")
                }
            }
        } header: {
            Text("Strava")
        } footer: {
            Text(isStravaConnected 
                ? "Your runs are automatically synced to Strava. Export historical data to Google Drive."
                : "Connect Strava to automatically sync your runs and export historical data.")
        }
        .sheet(isPresented: $showingStravaExport) {
            stravaExportSheet
        }
        .onAppear {
            checkStravaConnection()
        }
    }
    
    private var stravaExportSheet: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper("Days: \(stravaDays)", value: $stravaDays, in: 1...365)
                    Text("Export runs from the last \(stravaDays) days")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } header: {
                    Text("Export Range")
                }
                
                Section {
                    Button {
                        Task {
                            await exportStravaToGoogleDrive()
                        }
                    } label: {
                        HStack {
                            if stravaExporting {
                                ProgressView()
                                Text("Exporting...")
                            } else {
                                Text("Export to Google Drive")
                            }
                        }
                    }
                    .disabled(stravaExporting)
                }
            }
            .navigationTitle("Export Strava Data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingStravaExport = false
                    }
                }
            }
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
                Text("Target KPS")
                    .frame(width: 120, alignment: .leading)
                TextField("Target KPS", text: $targetNPIText)
                    .keyboardType(.decimalPad)
            }
            Button("Save Profile") {
                saveProfile()
            }
        } header: {
            Text("Runner Profile")
        } footer: {
            Text("Used for AI summaries, training distribution, and future pace/power estimates. Target KPS is used for AI analysis comparisons.")
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
                Text("Computed KPS \(Int(npiResult)) added to history")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        } header: {
            Text("Find My KPS")
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
        
        // Validate inputs before calculating
        guard RunMetricsCalculator.isValidRunForNPI(distanceMeters: distanceMeters, durationSeconds: duration) else {
            print("⚠️ Invalid run data for NPI calculation")
            return
        }
        
        let pace = duration / (distanceMeters / 1000)
        let npi = computeNPI(distanceMeters: distanceMeters, durationSeconds: duration)
        
        // Validate NPI before saving
        guard RunMetricsCalculator.isValidNPI(npi) else {
            print("⚠️ Calculated invalid NPI: \(npi)")
            return
        }
        
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
        // Use the validated calculateNPI function
        return RunMetricsCalculator.calculateNPI(
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds
        )
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
        Avg KPS \(Int(avgNPI)), best \(Int(bestNPI)).
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
    
    private func checkStravaConnection() {
        isStravaConnected = CloudTokenStorage.shared.hasTokens(provider: "strava")
    }
    
    private func connectStrava() {
        // Check if credentials are configured
        guard StravaService.shared.areCredentialsConfigured() else {
            saveConfirmationMessage = "Strava integration is not configured. Please contact the developer."
            showingSaveConfirmation = true
            return
        }
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            saveConfirmationMessage = "Could not find view controller for authentication"
            showingSaveConfirmation = true
            return
        }
        
        Task {
            do {
                let tokens = try await StravaService.shared.authenticate(presentingViewController: rootViewController)
                
                // Store tokens
                try CloudTokenStorage.shared.storeTokens(
                    provider: "strava",
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresAt
                )
                
                isStravaConnected = true
                saveConfirmationMessage = "✅ Connected to Strava! Your runs will now sync automatically."
                showingSaveConfirmation = true
            } catch {
                saveConfirmationMessage = "Failed to connect Strava: \(error.localizedDescription)"
                showingSaveConfirmation = true
            }
        }
    }
    
    private func disconnectStrava() {
        do {
            try CloudTokenStorage.shared.removeTokens(provider: "strava")
            isStravaConnected = false
            saveConfirmationMessage = "Strava disconnected"
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Failed to disconnect: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }
    
    private func exportStravaToGoogleDrive() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let _ = windowScene.windows.first?.rootViewController else {
            saveConfirmationMessage = "Could not find view controller"
            showingSaveConfirmation = true
            return
        }
        
        // Check Google Drive connection
        let cloudStatus = UnifiedStorageService.shared.getSyncStatus()
        guard cloudStatus.isConnected else {
            saveConfirmationMessage = "Please connect Google Drive first in Cloud Storage settings"
            showingSaveConfirmation = true
            return
        }
        
        stravaExporting = true
        defer { stravaExporting = false }
        
        do {
            // Get Strava tokens
            guard let tokens = try CloudTokenStorage.shared.getTokens(provider: "strava") else {
                throw StravaError.authenticationFailed("Not connected to Strava")
            }
            
            // Ensure token is valid
            var accessToken = tokens.accessToken
            if !CloudTokenStorage.shared.isTokenValid(provider: "strava") {
                let newTokens = try await StravaService.shared.refreshAccessToken(refreshToken: tokens.refreshToken)
                try CloudTokenStorage.shared.storeTokens(
                    provider: "strava",
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    expiresAt: newTokens.expiresAt
                )
                accessToken = newTokens.accessToken
            }
            
            // Fetch activities
            let activities = try await StravaService.shared.fetchActivities(accessToken: accessToken, days: stravaDays)
            
            // Convert to runs
            var runs: [[String: Any]] = []
            for activity in activities {
                guard activity.type == "Run" || activity.sport_type == "Run" else { continue }
                guard activity.distance > 0, activity.moving_time > 0 else { continue }
                
                let distanceKm = activity.distance / 1000.0
                let paceSecondsPerKm = Double(activity.moving_time) / distanceKm
                let speedKmH = 3600.0 / paceSecondsPerKm
                let factor = pow(distanceKm, 0.06)
                let npi = speedKmH * factor * 10.0
                
                let run: [String: Any] = [
                    "id": "strava_\(activity.id)",
                    "date": activity.start_date,
                    "source": "strava",
                    "distance": activity.distance,
                    "duration": activity.moving_time,
                    "avgPace": paceSecondsPerKm,
                    "avgNPI": npi,
                    "avgHeartRate": activity.average_heartrate ?? 0,
                    "avgCadence": activity.average_cadence != nil ? activity.average_cadence! * 2 : NSNull(),
                    "elevationGain": activity.total_elevation_gain ?? 0,
                    "stravaId": activity.id,
                    "stravaName": activity.name,
                    "stravaDescription": activity.description ?? NSNull(),
                ]
                runs.append(run)
            }
            
            if runs.isEmpty {
                saveConfirmationMessage = "No runs found in the last \(stravaDays) days"
                showingSaveConfirmation = true
                showingStravaExport = false
                return
            }
            
            // Prepare JSON data
            let jsonData = try JSONSerialization.data(withJSONObject: runs, options: .prettyPrinted)
            let filename = "strava-runs-last-\(stravaDays)-days-\(ISO8601DateFormatter().string(from: Date()).prefix(10)).json"
            
            // Upload to Google Drive - get token from CloudSyncService
            // We need to access the provider, but it's private, so we'll use a workaround
            // Check if Google Drive is connected
            let cloudStatus = UnifiedStorageService.shared.getSyncStatus()
            guard cloudStatus.isConnected else {
                throw CloudStorageError.authenticationFailed("Google Drive not connected")
            }
            
            // Get Google tokens
            guard let googleTokens = try CloudTokenStorage.shared.getTokens(provider: "google") else {
                throw CloudStorageError.authenticationFailed("Google Drive tokens not found")
            }
            
            // Create a temporary GoogleDriveProvider for upload
            let clientId = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? ""
            let clientSecret = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_SECRET") as? String ?? ""
            let reversedClientId = clientId.components(separatedBy: ".").reversed().joined(separator: ".")
            let redirectURI = "\(reversedClientId):/oauth2redirect/google"
            let provider = GoogleDriveProvider(clientId: clientId, clientSecret: clientSecret, redirectURI: redirectURI)
            
            // Ensure folder exists and upload
            let _ = try await provider.ensureFolderExists(accessToken: googleTokens.accessToken)
            let content = String(data: jsonData, encoding: .utf8) ?? ""
            try await provider.uploadFile(
                filename: filename,
                content: content.data(using: .utf8)!,
                accessToken: googleTokens.accessToken
            )
            
            saveConfirmationMessage = "✅ Successfully exported \(runs.count) runs to Google Drive!"
            showingSaveConfirmation = true
            showingStravaExport = false
        } catch {
            saveConfirmationMessage = "Export failed: \(error.localizedDescription)"
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
