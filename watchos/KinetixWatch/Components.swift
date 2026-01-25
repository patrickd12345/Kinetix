import SwiftUI

struct ScreenOutline: View {
    let current: Double; let target: Double
    var body: some View {
        GeometryReader { geo in
            let p = min(max(current/target, 0), 1.0)
            ZStack {
                RoundedRectangle(cornerRadius: 40, style: .continuous).stroke(Color.gray.opacity(0.3), lineWidth: 6)
                RoundedRectangle(cornerRadius: 40, style: .continuous).trim(from: 0, to: CGFloat(p)).stroke(p >= 1.0 ? Color.green : Color.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90)).animation(.spring(response: 0.6, dampingFraction: 0.8), value: p)
            }.edgesIgnoringSafeArea(.all)
        }
    }
}

struct RunnerTrack: View {
    let current: Double; let target: Double
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let pct = min(max(current/target, 0), 1.05)
            let x = w * CGFloat(pct)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.gray.opacity(0.3)).frame(height: 4)
                Capsule().fill(Color.cyan).frame(width: x, height: 4)
                Text("🏃").font(.system(size: 16)).position(x: x, y: geo.size.height/2).animation(.spring(response: 0.5, dampingFraction: 0.7), value: x).scaleEffect(x: -1, y: 1)
                Text("🏁").font(.system(size: 12)).position(x: w, y: geo.size.height/2)
            }
        }
    }
}

struct FireworksView: View {
    var body: some View { ZStack { Color.black.opacity(0.3); Text("🎉").font(.largeTitle) } }
}

struct StatBox: View {
    let title: String; let value: String; let color: Color
    var body: some View { VStack { Text(title).font(.system(size: 8, weight: .bold)).foregroundColor(Color.white.opacity(0.7)); Text(value).font(.system(size: 14, design: .monospaced)).foregroundColor(color) }.frame(maxWidth: .infinity).background(Color.gray.opacity(0.15)).cornerRadius(5) }
}


