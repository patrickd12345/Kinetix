import SwiftUI
import SwiftData

struct ActivityBuilderView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var connectivity = ConnectivityManager.shared
    @Query(sort: [SortDescriptor<ActivityTemplate>(\.lastModified, order: .reverse)]) private var activities: [ActivityTemplate]
    
    @State private var editingTemplate: ActivityTemplate?
    @State private var showingNew = false
    
    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(activities) { activity in
                        Button {
                            editingTemplate = activity
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: activity.icon)
                                    .frame(width: 28, height: 28)
                                    .foregroundColor(.cyan)
                                VStack(alignment: .leading) {
                                    Text(activity.name)
                                        .font(.headline)
                                    HStack(spacing: 6) {
                                        Tag(label: activity.goal.displayName, color: .orange)
                                        Tag(label: activity.primaryScreen.label, color: .green)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.gray)
                                    .font(.caption)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                } header: {
                    VStack(alignment: .leading) {
                        Text("Custom Activities")
                        if let last = connectivity.lastActivitySync {
                            Text("Last synced \(last.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                } footer: {
                    Text("Build focused modes for Form Monitor, Race, Burner, or free runs. Changes sync straight to your Watch.")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            .navigationTitle("Activity Builder")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        connectivity.syncActivitiesFromBuilder(currentTemplates())
                    } label: {
                        Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                    }
                    
                    Button {
                        showingNew = true
                    } label: {
                        Label("Add", systemImage: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showingNew) {
                ActivityEditorView(template: nil) { _ in
                    connectivity.syncActivitiesFromBuilder(currentTemplates())
                }
            }
            .sheet(item: $editingTemplate) { template in
                ActivityEditorView(template: template) { _ in
                    connectivity.syncActivitiesFromBuilder(currentTemplates())
                }
            }
            .onAppear {
                connectivity.bind(modelContext: modelContext)
            }
        }
    }
    
    private func currentTemplates() -> [ActivityTemplate] {
        (try? modelContext.fetch(FetchDescriptor<ActivityTemplate>())) ?? activities
    }
}

private struct Tag: View {
    let label: String
    let color: Color
    
    var body: some View {
        Text(label)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }
}
