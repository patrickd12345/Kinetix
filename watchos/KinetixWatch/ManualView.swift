import SwiftUI

// MARK: - PAGE 4: MANUAL
struct ManualView: View {
    @Binding var navigationPath: [String]
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                // Exit button
                Button(action: {
                    navigationPath.removeAll()
                }) {
                    HStack {
                        Image(systemName: "chevron.left")
                            .font(.caption)
                        Text("Back to Activities")
                            .font(.headline)
                    }
                    .foregroundColor(.cyan)
                }
                .padding(.bottom, 5)
                
                HStack { Image(systemName: "book.fill").foregroundColor(.cyan); Text("USER MANUAL").font(.headline).bold() }.padding(.bottom, 5)
                ManualCard(icon: "waveform.path.ecg", color: .cyan, title: "WHAT IS NPI?", desc: "Normalized Performance Index. Speed adjusted for fatigue.")
                ManualCard(icon: "flag.fill", color: .orange, title: "DYNAMIC FINISH", desc: "The time shown is how long to beat your Target if you hold current pace.")
                ManualCard(icon: "heart.fill", color: .red, title: "PHYSIO-PACER", desc: "Detects cardiac drift. If HR spikes while pace is flat, suggests recovery speed.")
                Text("v1.0 • Kinetix Labs").font(.footnote).foregroundColor(.gray).frame(maxWidth: .infinity).padding(.top, 20)
            }
        }
    }
}

struct ManualCard: View {
    let icon: String; let color: Color; let title: String; let desc: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Image(systemName: icon).font(.caption).foregroundColor(color); Text(title).font(.caption).fontWeight(.black).foregroundColor(.white) }
            Text(desc).font(.system(size: 10)).foregroundColor(.gray)
        }.padding(10).background(Color.gray.opacity(0.15)).cornerRadius(10).overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.5), lineWidth: 1))
    }
}






