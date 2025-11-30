import Cocoa
import Foundation

// 1. Define the output directory
let fileManager = FileManager.default
let currentPath = fileManager.currentDirectoryPath
let assetPath = "\(currentPath)/watchos/KinetixWatch/Assets.xcassets/AppIcon.appiconset"

do {
    try fileManager.createDirectory(atPath: assetPath, withIntermediateDirectories: true, attributes: nil)
} catch {
    print("Error creating directory: \(error)")
    exit(1)
}

// 2. Drawing Function
func drawIcon(size: Double, url: URL) {
    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let img = NSImage(size: rect.size)
    img.lockFocus()
    
    // Context
    guard let ctx = NSGraphicsContext.current?.cgContext else { return }
    
    // Background: Gradient (Cyan to Deep Blue)
    let colors = [
        NSColor(red: 0.0, green: 0.8, blue: 0.8, alpha: 1.0).cgColor, // Cyan
        NSColor(red: 0.0, green: 0.1, blue: 0.4, alpha: 1.0).cgColor  // Deep Blue
    ] as CFArray
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: [0.0, 1.0])!
    
    // Diagonal gradient
    ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: size), end: CGPoint(x: size, y: 0), options: [])
    
    // Kinetic "K"
    let path = NSBezierPath()
    path.lineWidth = size * 0.12
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    
    // "K" shape logic
    // Vertical bar
    path.move(to: NSPoint(x: size * 0.3, y: size * 0.8))
    path.line(to: NSPoint(x: size * 0.3, y: size * 0.2))
    
    // Top arm
    path.move(to: NSPoint(x: size * 0.3, y: size * 0.5))
    path.line(to: NSPoint(x: size * 0.75, y: size * 0.8))
    
    // Bottom leg
    path.move(to: NSPoint(x: size * 0.3, y: size * 0.5))
    path.line(to: NSPoint(x: size * 0.75, y: size * 0.2))
    
    // Add a "motion" dot/circle
    let dotSize = size * 0.1
    let dotRect = NSRect(x: size * 0.8, y: size * 0.5 - dotSize/2, width: dotSize, height: dotSize)
    let dotPath = NSBezierPath(ovalIn: dotRect)
    
    NSColor.white.setStroke()
    path.stroke()
    
    NSColor.white.setFill()
    dotPath.fill()
    
    img.unlockFocus()
    
    // Save
    if let tiff = img.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) {
        try? png.write(to: url)
    }
}

// 3. Generate Icons and Contents.json items
struct IconSpec {
    let idiom: String
    let size: Double
    let scale: Int
    let role: String?
    let subtype: String?
}

let specs: [IconSpec] = [
    // Universal/General
    IconSpec(idiom: "watch-marketing", size: 1024, scale: 1, role: nil, subtype: nil),
    
    // Watch Sizes
    IconSpec(idiom: "watch", size: 24, scale: 2, role: "notificationCenter", subtype: "38mm"),
    IconSpec(idiom: "watch", size: 27.5, scale: 2, role: "notificationCenter", subtype: "42mm"),
    IconSpec(idiom: "watch", size: 29, scale: 2, role: "companionSettings", subtype: nil),
    IconSpec(idiom: "watch", size: 29, scale: 3, role: "companionSettings", subtype: nil),
    IconSpec(idiom: "watch", size: 33, scale: 2, role: "notificationCenter", subtype: "45mm"), // Approximation for new sizes
    IconSpec(idiom: "watch", size: 40, scale: 2, role: "appLauncher", subtype: "38mm"),
    IconSpec(idiom: "watch", size: 44, scale: 2, role: "appLauncher", subtype: "40mm"), // Series 4
    IconSpec(idiom: "watch", size: 46, scale: 2, role: "appLauncher", subtype: "41mm"), // Series 7
    IconSpec(idiom: "watch", size: 50, scale: 2, role: "appLauncher", subtype: "44mm"), // Series 4
    IconSpec(idiom: "watch", size: 51, scale: 2, role: "appLauncher", subtype: "45mm"), // Series 7
    IconSpec(idiom: "watch", size: 54, scale: 2, role: "appLauncher", subtype: "49mm"), // Ultra
    IconSpec(idiom: "watch", size: 86, scale: 2, role: "quickLook", subtype: "38mm"),
    IconSpec(idiom: "watch", size: 98, scale: 2, role: "quickLook", subtype: "42mm"),
    IconSpec(idiom: "watch", size: 108, scale: 2, role: "quickLook", subtype: "44mm"),
]

var imagesJson: [[String: String]] = []

for spec in specs {
    let pixelSize = spec.size * Double(spec.scale)
    let filename = "Icon-\(spec.size)x\(spec.scale).png"
    let url = URL(fileURLWithPath: "\(assetPath)/\(filename)")
    
    drawIcon(size: pixelSize, url: url)
    
    var jsonItem: [String: String] = [
        "size": "\(spec.size)x\(spec.size)",
        "idiom": spec.idiom,
        "filename": filename,
        "scale": "\(spec.scale)x"
    ]
    
    if let role = spec.role { jsonItem["role"] = role }
    if let subtype = spec.subtype { jsonItem["subtype"] = subtype }
    
    imagesJson.append(jsonItem)
}

// 4. Write Contents.json
let contents: [String: Any] = [
    "images": imagesJson,
    "info": [
        "version": 1,
        "author": "xcode"
    ]
]

if let jsonData = try? JSONSerialization.data(withJSONObject: contents, options: .prettyPrinted) {
    let jsonUrl = URL(fileURLWithPath: "\(assetPath)/Contents.json")
    try? jsonData.write(to: jsonUrl)
}

print("Icons generated successfully.")

