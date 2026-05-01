import Foundation

/// User-facing KPS on Home is PB-relative; lifetime best is 100 and must not display above that.
/// Mirrors `apps/web/src/lib/kpsDisplayPolicy.ts` (`capDisplayRelativeKps`).
enum KpsRelativeDisplay {
    static let maxDisplayRelativeKPS: Double = 100

    /// Identity + score only — safe for unit tests (do not instantiate `@Model` `Run` without a context).
    struct RunNPISnapshot: Equatable {
        let id: UUID
        let avgNPI: Double
    }

    static func capDisplayRelativeKps(_ raw: Double) -> Double {
        guard raw.isFinite, raw > 0, !raw.isNaN else { return 0 }
        return min(raw, maxDisplayRelativeKPS)
    }

    static func personalBest(from entries: [RunNPISnapshot]) -> RunNPISnapshot? {
        entries
            .filter { RunMetricsCalculator.isValidNPI($0.avgNPI) }
            .max(by: { $0.avgNPI < $1.avgNPI })
    }

    /// PB-relative display KPS (pure; test without SwiftData `Run`).
    static func displayRelativeKps(runNPI: Double, runId: UUID, among entries: [RunNPISnapshot]) -> Double {
        guard RunMetricsCalculator.isValidNPI(runNPI),
              let pb = personalBest(from: entries),
              RunMetricsCalculator.isValidNPI(pb.avgNPI),
              pb.avgNPI > 0
        else { return 0 }

        if runId == pb.id {
            return capDisplayRelativeKps(100)
        }

        let raw = (runNPI / pb.avgNPI) * 100
        guard raw.isFinite, !raw.isNaN else { return 0 }
        return capDisplayRelativeKps(raw)
    }

    /// Run with highest stored absolute score (`avgNPI`) in the given list.
    static func personalBestRun(from runs: [Run]) -> Run? {
        let snapshots = runs.map { RunNPISnapshot(id: $0.id, avgNPI: $0.avgNPI) }
        guard let pb = personalBest(from: snapshots) else { return nil }
        return runs.first { $0.id == pb.id }
    }

    /// PB-relative display KPS for a run. Uses native **NPI** (`avgNPI`) as the absolute score,
    /// matching the ratio structure of web `calculateRelativeKPS` / `calculateRelativeKPSSync`
    /// (`packages/core` absolute KPS is not ported on-device; NPI is the shared native absolute proxy).
    static func displayRelativeKps(for run: Run, among runs: [Run]) -> Double {
        let entries = runs.map { RunNPISnapshot(id: $0.id, avgNPI: $0.avgNPI) }
        return displayRelativeKps(runNPI: run.avgNPI, runId: run.id, among: entries)
    }

    /// User-facing KPS points for labels and hero (0…100). Never exceeds 100.
    static func displayKpsInt(for run: Run, among runs: [Run]) -> Int {
        let d = displayRelativeKps(for: run, among: runs)
        guard d > 0, d.isFinite, !d.isNaN else { return 0 }
        return min(100, max(0, Int(floor(d))))
    }
}
