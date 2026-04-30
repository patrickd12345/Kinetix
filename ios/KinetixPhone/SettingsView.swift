import SwiftUI
import SwiftData
import UIKit
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject private var entitlementService = EntitlementService.shared
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Query(sort: [SortDescriptor<WeightEntry>(\.recordedAt, order: .reverse)]) private var weightEntries: [WeightEntry]
    @Query private var profiles: [RunnerProfile]
    @Query(sort: [SortDescriptor<CustomBatteryProfile>(\.name)]) private var batteryProfiles: [CustomBatteryProfile]
    @AppStorage("weightUnit") private var weightUnit: String = "lbs"
    @AppStorage("weightSource") private var weightSource: String = "profile"
    @AppStorage("lastWithingsWeightKg") private var lastWithingsWeightKg: Double = 0
    @AppStorage("livePaceRollingWindowSeconds") private var livePaceRollingWindowSeconds: Double = LivePaceCalculator.defaultRollingWindowSeconds
    
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
    @State private var stravaImporting = false
    @State private var stravaExporting = false
    @State private var showingStravaExport = false
    @State private var stravaDays = 90
    @State private var isWithingsConnected = false
    @State private var withingsRefreshing = false
    @State private var withingsSyncing = false
    @State private var showingWeightImportPicker = false
    
    @State private var ollamaURL: String = "http://localhost:11434"
    @State private var ollamaModel: String = "llama3.2"
    @State private var ollamaAvailable: Bool = false
    @State private var checkingOllama = false
    @State private var showAdvancedAISettings = false
    @State private var showDeveloperCoachTools = false
    /// Used only by `#if DEBUG` developer Gemini section (never shown in Release UI).
    @State private var geminiApiKeyDraft: String = ""
    @State private var geminiKeyStatusMessage: String?
    @AppStorage("kinetix_dev_enable_gemini_coach_chat") private var devGeminiCoachChatEnabled = false
    
    private let sexOptions = ["unspecified", "female", "male", "nonbinary"]
    private let kgToLbs = 2.20462
    private let appleIntelligenceService: KinetixAppleIntelligenceService = DefaultKinetixAppleIntelligenceService.shared
    
    var body: some View {
        NavigationStack {
            List {
                profileSection
                withingsSection
                Group {
                    if Features.requireEntitlementForPaidSurfaces && !entitlementService.state.isActive {
                        entitlementGateSection
                    } else {
                        cloudStorageSection
                        stravaSection
                    }
                }
                aiSettingsSection
                liveTrackingSection
                omniIntelligenceSection
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
                normalizeWeightUnitIfNeeded()
                bootstrapProfile()
                checkWithingsConnection()
                updateCloudSyncStatus()
                loadOllamaSettings()
                checkOllamaAvailability()
                loadGeminiApiKeyDraft()
            }
            .onChange(of: weightUnit) { oldValue, newValue in
                guard oldValue != newValue else { return }
                convertDisplayedWeight(from: oldValue, to: newValue)
            }
            .fileImporter(
                isPresented: $showingWeightImportPicker,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    Task {
                        await importWeightHistoryJSON(from: url)
                    }
                case .failure(let error):
                    saveConfirmationMessage = "Weight import failed: \(error.localizedDescription)"
                    showingSaveConfirmation = true
                }
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

    private var withingsSection: some View {
        Section {
            Picker("Weight Source", selection: $weightSource) {
                Text("Profile").tag("profile")
                Text("Withings").tag("withings")
            }
            .pickerStyle(.segmented)

            HStack {
                if isWithingsConnected {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                } else {
                    Label("Not Connected", systemImage: "xmark.circle")
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("Withings")
                    .foregroundColor(.secondary)
            }

            if lastWithingsWeightKg > 0 {
                HStack {
                    Text("Latest Weight")
                    Spacer()
                    Text("\(displayWeight(lastWithingsWeightKg)) \(weightUnit)")
                        .foregroundColor(.cyan)
                }
            }

            if !weightEntries.isEmpty {
                HStack {
                    Text("History Entries")
                    Spacer()
                    Text("\(weightEntries.count)")
                        .foregroundColor(.secondary)
                }
            }

            if isWithingsConnected {
                Button {
                    Task { await refreshWithingsWeight() }
                } label: {
                    HStack {
                        if withingsRefreshing {
                            ProgressView().scaleEffect(0.8)
                            Text("Refreshing...")
                        } else {
                            Label("Refresh Weight", systemImage: "arrow.clockwise")
                        }
                    }
                }
                .disabled(withingsRefreshing || withingsSyncing)

                Button {
                    Task { await syncRecentWithingsWeights() }
                } label: {
                    HStack {
                        if withingsSyncing {
                            ProgressView().scaleEffect(0.8)
                            Text("Syncing...")
                        } else {
                            Label("Sync Last 30 Days", systemImage: "waveform.path.ecg")
                        }
                    }
                }
                .disabled(withingsSyncing || withingsRefreshing)

                Button(role: .destructive) {
                    disconnectWithings()
                } label: {
                    Label("Disconnect", systemImage: "xmark.circle")
                }
            } else {
                Button {
                    connectWithings()
                } label: {
                    Label("Connect Withings", systemImage: "scalemass")
                }
            }

            NavigationLink {
                WeightHistoryView()
            } label: {
                Label("Weight History", systemImage: "chart.xyaxis.line")
            }

            Button {
                showingWeightImportPicker = true
            } label: {
                Label("Import Weight History (JSON)", systemImage: "square.and.arrow.down")
            }
        } header: {
            Text("Withings")
        } footer: {
            Text("Connect your Withings smart scale to sync recent weigh-ins. Weight history is stored on-device and shown using your selected unit.")
        }
    }

    private var entitlementGateSection: some View {
        Section {
            Text(entitlementService.state.reason ?? "Subscription status unavailable.")
                .font(.caption)
                .foregroundColor(.secondary)
            Button("Refresh entitlement status") {
                Task { await EntitlementService.shared.refresh() }
            }
            ManageAccountOnWebButton()
        } header: {
            Text("Kinetix membership")
        } footer: {
            Text("Paid integrations stay hidden until GET /api/entitlements returns active=true (Lane A). Billing is handled on kinetix.bookiji.com.")
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
                    Task {
                        await importRunsFromStrava()
                    }
                } label: {
                    HStack {
                        if stravaImporting {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Importing…")
                        } else {
                            Label("Import from Strava", systemImage: "square.and.arrow.down")
                        }
                    }
                }
                .disabled(stravaImporting || stravaExporting)

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
                .disabled(stravaExporting || stravaImporting)
                
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

            #if DEBUG
            DisclosureGroup(isExpanded: $showDeveloperCoachTools) {
                geminiDeveloperCoachChatSection
            } label: {
                Text("Developer tools")
                    .font(.subheadline)
            }
            #endif
            
            // Advanced Settings (collapsed by default)
            if showAdvancedAISettings {
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
            Text("Coach & analysis")
        } footer: {
            Text("Coach chat uses on-device AI when your iPhone supports it. Otherwise you’ll see a short unavailable message. Optional local analysis tools are under Advanced settings.")
        }
    }

    #if DEBUG
    private var geminiDeveloperCoachChatSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Developer — experimental coach chat")
                .font(.subheadline)
                .foregroundColor(.orange)
            Text("DEBUG builds only. Optional Gemini key for engineering; Release builds never show this section.")
                .font(.caption)
                .foregroundColor(.secondary)
            Toggle("Enable Gemini coach chat (debug)", isOn: $devGeminiCoachChatEnabled)
            SecureField("Gemini API key (debug)", text: $geminiApiKeyDraft)
                .textContentType(.password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            HStack {
                Button("Save key") {
                    saveGeminiApiKeyFromDraft()
                }
                Button("Remove key") {
                    removeGeminiApiKey()
                }
                .foregroundColor(.red)
            }
            .font(.subheadline)
            if let msg = geminiKeyStatusMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    #endif

    private func loadGeminiApiKeyDraft() {
        geminiApiKeyDraft = ApiKeyStorage.shared.getKey(name: "gemini_api_key") ?? ""
    }

    private func saveGeminiApiKeyFromDraft() {
        let trimmed = geminiApiKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try ApiKeyStorage.shared.storeKey(name: "gemini_api_key", value: trimmed)
            geminiKeyStatusMessage = trimmed.isEmpty ? "Key removed." : "Key saved (debug)."
            loadGeminiApiKeyDraft()
        } catch {
            geminiKeyStatusMessage = error.localizedDescription
        }
    }

    private func removeGeminiApiKey() {
        do {
            try ApiKeyStorage.shared.removeKey(name: "gemini_api_key")
            geminiApiKeyDraft = ""
            geminiKeyStatusMessage = "Key removed."
        } catch {
            geminiKeyStatusMessage = error.localizedDescription
        }
    }
    
    private var omniIntelligenceSection: some View {
        Section {
            NavigationLink(destination: TechnicalInsightsView()) {
                HStack {
                    Label("Technical Insights", systemImage: "brain.head.profile")
                    Spacer()
                    Text("Reasoning Logs")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }

        } header: {
            Text("Omni-Intelligence")
        } footer: {
            Text("Garmin Cloud integration is excluded from v1 (see docs/IOS_LAUNCH_CHECKLIST.md). Recovery-aware coaching still uses on-device and Health-derived signals where available.")
        }
    }

    private var aiStatusDescription: String {
        if appleIntelligenceService.isAppleIntelligenceAvailable() == .available {
            return "On-device AI path available for supported summaries (iOS 26+ iPhone)"
        }
        if ollamaAvailable {
            return "Ollama reachable — optional for run analysis"
        }
        return "Built-in rules when optional AI backends aren’t available"
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

    private var liveTrackingSection: some View {
        Section {
            Stepper(
                value: $livePaceRollingWindowSeconds,
                in: 1...15,
                step: 1
            ) {
                Text("Live Pace Window: \(Int(livePaceRollingWindowSeconds))s")
            }
        } header: {
            Text("Live Tracking")
        } footer: {
            Text("Controls the rolling window used for live pace display during active runs. Average pace is still used for saved run summaries and history.")
        }
    }
    
    private var profileSection: some View {
        Section {
            Picker("Weight Unit", selection: $weightUnit) {
                Text("kg").tag("kg")
                Text("lbs").tag("lbs")
            }
            .pickerStyle(.segmented)

            HStack {
                Text("Weight (\(weightUnit))")
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
            Text("Used for AI summaries, training distribution, and future pace/power estimates. Target KPS is used for AI analysis comparisons. Weight is stored in kg.")
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
                Task { await generateAISummary() }
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

    private func normalizeWeightUnitIfNeeded() {
        if weightUnit != "kg" && weightUnit != "lbs" {
            weightUnit = "lbs"
        }
    }

    private func formatWeightForDisplay(_ weightKg: Double) -> String {
        let displayWeight = weightUnit == "lbs" ? weightKg * kgToLbs : weightKg
        return String(format: "%.1f", displayWeight)
    }

    private func parseEnteredWeightToKg() -> Double? {
        guard let entered = Double(weightText), entered > 0 else { return nil }
        if weightUnit == "lbs" {
            return entered / kgToLbs
        }
        return entered
    }

    private func convertDisplayedWeight(from oldUnit: String, to newUnit: String) {
        guard let currentDisplayWeight = Double(weightText), currentDisplayWeight > 0 else { return }
        let oldIsLbs = oldUnit == "lbs"
        let newIsLbs = newUnit == "lbs"
        let asKg = oldIsLbs ? (currentDisplayWeight / kgToLbs) : currentDisplayWeight
        let converted = newIsLbs ? (asKg * kgToLbs) : asKg
        weightText = String(format: "%.1f", converted)
    }

    private func displayWeight(_ kg: Double) -> String {
        formatWeightForDisplay(kg)
    }

    private func checkWithingsConnection() {
        isWithingsConnected = CloudTokenStorage.shared.hasTokens(provider: "withings")
        if !isWithingsConnected && weightSource == "withings" {
            weightSource = "profile"
        }
        if lastWithingsWeightKg <= 0, let latest = weightEntries.first?.kg {
            lastWithingsWeightKg = latest
        }
    }

    private func connectWithings() {
        Task {
            await connectWithingsAsync()
        }
    }

    @MainActor
    private func connectWithingsAsync() async {
        guard WithingsService.shared.areCredentialsConfigured() else {
            saveConfirmationMessage = "Withings is disabled until Lane A ships a token proxy. Set WITHINGS_CLIENT_ID in xcconfig only; secrets must not ship in the bundle."
            showingSaveConfirmation = true
            return
        }

        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            saveConfirmationMessage = "Could not find view controller for authentication"
            showingSaveConfirmation = true
            return
        }

        withingsRefreshing = true
        defer { withingsRefreshing = false }

        do {
            let tokens = try await WithingsService.shared.authenticate(presentingViewController: rootViewController)
            try CloudTokenStorage.shared.storeTokens(
                provider: "withings",
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt
            )
            isWithingsConnected = true
            weightSource = "withings"

            let sync = try await WithingsService.shared.syncRecentWeights(modelContext: modelContext, daysBack: 30)
            if let latest = sync.latestKg {
                lastWithingsWeightKg = latest
                try applyWithingsWeightToProfile(latest)
                ConnectivityManager.shared.syncWithingsWeightToWatch(latest)
            }

            saveConfirmationMessage = "Connected to Withings. Imported \(sync.imported) recent weight entr\(sync.imported == 1 ? "y" : "ies")."
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Withings connect failed: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }

    @MainActor
    private func refreshWithingsWeight() async {
        guard isWithingsConnected else {
            saveConfirmationMessage = "Connect Withings first."
            showingSaveConfirmation = true
            return
        }

        withingsRefreshing = true
        defer { withingsRefreshing = false }

        do {
            let tokens = try await WithingsService.shared.ensureValidAccessToken()
            let latest = try await WithingsService.shared.fetchLatestWeightKg(accessToken: tokens.accessToken)
            if let latest {
                lastWithingsWeightKg = latest
                if weightSource == "withings" {
                    try applyWithingsWeightToProfile(latest)
                }
                ConnectivityManager.shared.syncWithingsWeightToWatch(latest)
                saveConfirmationMessage = "Latest Withings weight: \(displayWeight(latest)) \(weightUnit)."
            } else {
                saveConfirmationMessage = "No recent weight found from Withings."
            }
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Failed to refresh Withings weight: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }

    @MainActor
    private func syncRecentWithingsWeights() async {
        guard isWithingsConnected else {
            saveConfirmationMessage = "Connect Withings first."
            showingSaveConfirmation = true
            return
        }

        withingsSyncing = true
        defer { withingsSyncing = false }

        do {
            let sync = try await WithingsService.shared.syncRecentWeights(modelContext: modelContext, daysBack: 30)
            if let latest = sync.latestKg {
                lastWithingsWeightKg = latest
                if weightSource == "withings" {
                    try applyWithingsWeightToProfile(latest)
                }
                ConnectivityManager.shared.syncWithingsWeightToWatch(latest)
            }
            saveConfirmationMessage = "Synced \(sync.imported) weight entr\(sync.imported == 1 ? "y" : "ies") from Withings."
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Withings sync failed: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }

    private func disconnectWithings() {
        do {
            try CloudTokenStorage.shared.removeTokens(provider: "withings")
        } catch {
            saveConfirmationMessage = "Failed to disconnect Withings: \(error.localizedDescription)"
            showingSaveConfirmation = true
            return
        }

        isWithingsConnected = false
        weightSource = "profile"
        lastWithingsWeightKg = 0
        ConnectivityManager.shared.syncWithingsWeightToWatch(0)
        saveConfirmationMessage = "Withings disconnected."
        showingSaveConfirmation = true
    }

    @MainActor
    private func applyWithingsWeightToProfile(_ kg: Double) throws {
        guard kg > 0 else { return }
        let profile = profiles.first ?? RunnerProfile()
        profile.weightKg = kg
        if profiles.isEmpty {
            modelContext.insert(profile)
        }
        weightText = formatWeightForDisplay(kg)
        try modelContext.save()
    }

    @MainActor
    private func importWeightHistoryJSON(from url: URL) async {
        let hasScopedAccess = url.startAccessingSecurityScopedResource()
        defer {
            if hasScopedAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let data = try Data(contentsOf: url)
            let samples = try parseWeightSamplesFromJSON(data)
            guard !samples.isEmpty else {
                saveConfirmationMessage = "No valid weight entries found in JSON."
                showingSaveConfirmation = true
                return
            }

            let inserted = try WithingsService.shared.importWeightSamples(samples, modelContext: modelContext)
            if let latest = samples.first?.kg {
                lastWithingsWeightKg = latest
                if weightSource == "withings" {
                    try applyWithingsWeightToProfile(latest)
                }
                ConnectivityManager.shared.syncWithingsWeightToWatch(latest)
            }
            saveConfirmationMessage = "Imported \(inserted) weight entr\(inserted == 1 ? "y" : "ies")."
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Weight import failed: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }

    private func parseWeightSamplesFromJSON(_ data: Data) throws -> [WithingsWeightSample] {
        guard let array = try JSONSerialization.jsonObject(with: data, options: []) as? [[String: Any]] else {
            throw WithingsError.networkError("Expected an array of weight entries")
        }

        var samples: [WithingsWeightSample] = []
        samples.reserveCapacity(array.count)

        for item in array {
            guard let kg = parseNumeric(item["kg"]), kg > 0 else { continue }

            var dateUnix: Int?
            if let unix = item["dateUnix"] as? Int {
                dateUnix = unix
            } else if let unixString = item["dateUnix"] as? String, let parsed = Int(unixString) {
                dateUnix = parsed
            } else if let isoDate = item["date"] as? String,
                      let parsedDate = ISO8601DateFormatter().date(from: isoDate) {
                dateUnix = Int(parsedDate.timeIntervalSince1970)
            }

            guard let finalUnix = dateUnix, finalUnix > 0 else { continue }
            let recordedAt = Date(timeIntervalSince1970: TimeInterval(finalUnix))
            samples.append(WithingsWeightSample(dateUnix: finalUnix, recordedAt: recordedAt, kg: kg))
        }

        return samples.sorted(by: { $0.dateUnix > $1.dateUnix })
    }

    private func parseNumeric(_ value: Any?) -> Double? {
        if let doubleValue = value as? Double { return doubleValue }
        if let intValue = value as? Int { return Double(intValue) }
        if let number = value as? NSNumber { return number.doubleValue }
        if let stringValue = value as? String { return Double(stringValue) }
        return nil
    }
    
    private func bootstrapProfile() {
        guard let profile = profiles.first else {
            let newProfile = RunnerProfile()
            modelContext.insert(newProfile)
            weightText = formatWeightForDisplay(newProfile.weightKg)
            birthDate = newProfile.dateOfBirth
            sex = newProfile.sex
            targetNPIText = String(format: "%.0f", newProfile.targetNPI)
            return
        }
        weightText = formatWeightForDisplay(profile.weightKg)
        birthDate = profile.dateOfBirth
        sex = profile.sex
        targetNPIText = String(format: "%.0f", profile.targetNPI)
    }
    
    private func saveProfile() {
        let profile = profiles.first ?? RunnerProfile()
        if let weightInKg = parseEnteredWeightToKg() {
            profile.weightKg = weightInKg
        }
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
            print("⚠️ Invalid run data for KPS calculation")
            return
        }
        
        let pace = duration / (distanceMeters / 1000)
        let npi = computeNPI(distanceMeters: distanceMeters, durationSeconds: duration)
        
        // Validate NPI before saving
        guard RunMetricsCalculator.isValidNPI(npi) else {
            print("⚠️ Calculated invalid KPS: \(npi)")
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
    
    private func generateAISummary() async {
        guard !recentRuns.isEmpty else {
            summaryError = "Not enough workouts to summarize."
            return
        }
        summaryError = nil
        let totalDistance = recentRuns.map(\.distance).reduce(0, +) / 1000
        let totalDuration = recentRuns.map(\.duration).reduce(0, +)
        let avgNPI = recentRuns.map(\.avgNPI).reduce(0, +) / Double(recentRuns.count)
        let bestNPI = recentRuns.map(\.avgNPI).max() ?? avgNPI
        let stabilityScore = recentRuns.compactMap { $0.formScore }.averageOrNil() ?? 0
        let cadence = recentRuns.compactMap { $0.avgCadence }.averageOrNil() ?? 0
        
        let trendDirection = avgNPI >= bestNPI * 0.95 ? "stable" : "improving"
        let result = await appleIntelligenceService.generatePostRunSummary(
            PostRunSummaryInput(
                distance: totalDistance * 1000,
                duration: totalDuration,
                pace: recentRuns.compactMap(\.avgPace).averageOrNil() ?? 0,
                kps: avgNPI,
                heartRateAvg: recentRuns.compactMap(\.avgHeartRate).averageOrNil(),
                trendDirection: trendDirection
            )
        )

        let deterministicSummary = """
        Past \(recentRuns.count) workouts: \(String(format: "%.1f", totalDistance)) km total.
        Avg KPS \(Int(avgNPI)), best \(Int(bestNPI)).
        Stability \(Int(stabilityScore)) / cadence \(Int(cadence)) spm.
        Focus on smoother ground contact and even strides. Recovery days every 3rd run.
        """
        aiSummary = result.usedFallback ? deterministicSummary : result.text
    }
    
    private func updateCloudSyncStatus() {
        cloudSyncStatus = UnifiedStorageService.shared.getSyncStatus()
    }
    
    private func loadOllamaSettings() {
        ollamaURL = UserDefaults.standard.string(forKey: "ollama_api_url") ?? "http://localhost:11434"
        ollamaModel = UserDefaults.standard.string(forKey: "ollama_model") ?? "llama3.2"
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
                saveConfirmationMessage = "Google OAuth needs GOOGLE_CLIENT_ID in build configuration (xcconfig). iOS clients usually omit the client secret."
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
        guard !stravaImporting && !stravaExporting else {
            saveConfirmationMessage = "Please wait for the current Strava operation to finish."
            showingSaveConfirmation = true
            return
        }

        if isStravaConnected {
            saveConfirmationMessage = "Strava is already connected."
            showingSaveConfirmation = true
            return
        }

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
        guard !stravaImporting else {
            saveConfirmationMessage = "Please wait for Strava import to finish before exporting."
            showingSaveConfirmation = true
            return
        }

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

    private func importRunsFromStrava() async {
        guard !stravaImporting else { return }
        guard !stravaExporting else {
            saveConfirmationMessage = "Please wait for Strava export to finish before importing."
            showingSaveConfirmation = true
            return
        }

        stravaImporting = true
        defer { stravaImporting = false }

        do {
            guard let tokens = try CloudTokenStorage.shared.getTokens(provider: "strava") else {
                throw StravaError.authenticationFailed("Not connected to Strava")
            }

            var accessToken = tokens.accessToken
            if !CloudTokenStorage.shared.isTokenValid(provider: "strava") {
                let refreshed = try await StravaService.shared.refreshAccessToken(refreshToken: tokens.refreshToken)
                try CloudTokenStorage.shared.storeTokens(
                    provider: "strava",
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: refreshed.expiresAt
                )
                accessToken = refreshed.accessToken
            }

            let activities = try await StravaService.shared.fetchActivities(accessToken: accessToken, days: stravaDays)
            let existingRuns = runs.filter { $0.source == "strava" }
            var imported = 0

            for activity in activities {
                guard activity.type == "Run" || activity.sport_type == "Run" else { continue }
                guard activity.distance > 0, activity.moving_time > 0 else { continue }
                guard let activityDate = ISO8601DateFormatter().date(from: activity.start_date) else { continue }

                let duplicate = existingRuns.contains { run in
                    abs(run.date.timeIntervalSince(activityDate)) < 1 &&
                    abs(run.distance - activity.distance) < 1 &&
                    abs(run.duration - Double(activity.moving_time)) < 1
                }
                if duplicate { continue }

                let distanceKm = activity.distance / 1000.0
                let paceSecondsPerKm = Double(activity.moving_time) / distanceKm
                let speedKmH = 3600.0 / paceSecondsPerKm
                let factor = pow(distanceKm, 0.06)
                let npi = speedKmH * factor * 10.0

                let run = Run(
                    date: activityDate,
                    source: "strava",
                    distance: activity.distance,
                    duration: Double(activity.moving_time),
                    avgPace: paceSecondsPerKm,
                    avgNPI: npi,
                    avgHeartRate: activity.average_heartrate ?? 0,
                    avgCadence: activity.average_cadence != nil ? activity.average_cadence! * 2 : nil,
                    avgVerticalOscillation: nil,
                    avgGroundContactTime: nil,
                    avgStrideLength: nil,
                    formScore: nil,
                    routeData: []
                )
                modelContext.insert(run)
                imported += 1
            }

            try modelContext.save()
            saveConfirmationMessage = imported > 0
                ? "✅ Imported \(imported) new run\(imported == 1 ? "" : "s") from Strava."
                : "No new Strava runs found to import."
            showingSaveConfirmation = true
        } catch {
            saveConfirmationMessage = "Strava import failed: \(error.localizedDescription)"
            showingSaveConfirmation = true
        }
    }
}

struct WeightHistoryView: View {
    @Query(sort: [SortDescriptor<WeightEntry>(\.recordedAt, order: .reverse)]) private var entries: [WeightEntry]
    @AppStorage("weightUnit") private var weightUnit: String = "lbs"
    private let kgToLbs = 2.20462

    var body: some View {
        List {
            if entries.isEmpty {
                ContentUnavailableView(
                    "No Weight Entries",
                    systemImage: "scalemass",
                    description: Text("Connect Withings or import JSON to populate weight history.")
                )
            } else {
                ForEach(entries) { entry in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.recordedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Text("Unix: \(entry.dateUnix)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Text("\(formatWeight(entry.kg)) \(weightUnit)")
                            .font(.headline)
                            .foregroundColor(.cyan)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("Weight History")
    }

    private func formatWeight(_ kg: Double) -> String {
        let value = weightUnit == "lbs" ? kg * kgToLbs : kg
        return String(format: "%.2f", value)
    }
}

private extension Array where Element == Double {
    func averageOrNil() -> Double? {
        guard !isEmpty else { return nil }
        return reduce(0, +) / Double(count)
    }
}
