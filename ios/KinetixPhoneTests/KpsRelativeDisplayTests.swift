import XCTest
@testable import KinetixPhone

final class KpsRelativeDisplayTests: XCTestCase {
    func testCapDisplayRelativeKpsMirrorsWebPolicy() {
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(0), 0)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(-1), 0)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(.nan), 0)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(.infinity), 0)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(50), 50)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(100), 100)
        XCTAssertEqual(KpsRelativeDisplay.capDisplayRelativeKps(150), 100)
    }

    func testPersonalBestRunPicksMaxNpi() {
        let idA = UUID()
        let idB = UUID()
        let a = KpsRelativeDisplay.RunNPISnapshot(id: idA, avgNPI: 100)
        let b = KpsRelativeDisplay.RunNPISnapshot(id: idB, avgNPI: 180)
        let pb = KpsRelativeDisplay.personalBest(from: [a, b])
        XCTAssertEqual(pb?.id, idB)
    }

    func testPbRunScores100() {
        let id = UUID()
        let only = KpsRelativeDisplay.RunNPISnapshot(id: id, avgNPI: 132)
        let kps = KpsRelativeDisplay.displayRelativeKps(runNPI: only.avgNPI, runId: id, among: [only])
        XCTAssertEqual(kps, 100)
    }

    func testNonPbRunIsRatioCappedAt100() {
        let idWeak = UUID()
        let idStrong = UUID()
        let weak = KpsRelativeDisplay.RunNPISnapshot(id: idWeak, avgNPI: 100)
        let strong = KpsRelativeDisplay.RunNPISnapshot(id: idStrong, avgNPI: 200)
        let kps = KpsRelativeDisplay.displayRelativeKps(runNPI: weak.avgNPI, runId: idWeak, among: [weak, strong])
        XCTAssertEqual(kps, 50, accuracy: 0.001)
    }

    func testRatioAbove100DisplaysAs100() {
        let idWeak = UUID()
        let idStrong = UUID()
        let weak = KpsRelativeDisplay.RunNPISnapshot(id: idWeak, avgNPI: 50)
        let strong = KpsRelativeDisplay.RunNPISnapshot(id: idStrong, avgNPI: 100)
        let rawRatio = (150.0 / 100.0) * 100
        XCTAssertGreaterThan(rawRatio, 100)
        let kps = KpsRelativeDisplay.displayRelativeKps(runNPI: 150, runId: idWeak, among: [weak, strong])
        XCTAssertEqual(kps, 100, accuracy: 0.001)
    }
}
