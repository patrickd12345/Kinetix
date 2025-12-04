import Foundation
import CoreLocation
#if canImport(FITSwiftSDK)
import FITSwiftSDK
#endif

class RunExporter {
    
    // MARK: - GPX Generation
    static func generateGPX(run: Run) -> String {
        let df = ISO8601DateFormatter()
        df.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        var gpx = """
        <?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="Kinetix" xmlns="http://www.topografix.com/GPX/1/1">
          <metadata>
            <name>Kinetix Run \(run.date.formatted(date: .numeric, time: .omitted))</name>
            <time>\(df.string(from: run.date))</time>
          </metadata>
          <trk>
            <name>Run on \(run.date.formatted(date: .abbreviated, time: .shortened))</name>
            <trkseg>
        """
        
        let points = run.routeData
        let count = points.count
        
        if count > 0 {
            // Interpolate time
            let duration = run.duration
            let interval = duration / Double(count)
            
            for (index, point) in points.enumerated() {
                let timeOffset = interval * Double(index)
                let timestamp = run.date.addingTimeInterval(timeOffset)
                
                gpx += """
                
                <trkpt lat="\(point.lat)" lon="\(point.lon)">
                    <ele>0</ele>
                    <time>\(df.string(from: timestamp))</time>
                </trkpt>
                """
            }
        }
        
        gpx += """
        
            </trkseg>
          </trk>
        </gpx>
        """
        
        return gpx
    }
    
    // MARK: - TCX Generation
    static func generateTCX(run: Run) -> String {
        let df = ISO8601DateFormatter()
        df.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        var tcx = """
        <?xml version="1.0" encoding="UTF-8"?>
        <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
          <Activities>
            <Activity Sport="Running">
              <Id>\(df.string(from: run.date))</Id>
              <Lap StartTime="\(df.string(from: run.date))">
                <TotalTimeSeconds>\(run.duration)</TotalTimeSeconds>
                <DistanceMeters>\(run.distance)</DistanceMeters>
                <Calories>0</Calories>
                <Intensity>Active</Intensity>
                <TriggerMethod>Manual</TriggerMethod>
                <Track>
        """
        
        let points = run.routeData
        let count = points.count
        
        if count > 0 {
            let duration = run.duration
            let interval = duration / Double(count)
            
            // Distribute distance linearly as well (approx)
            let distInterval = run.distance / Double(count)
            
            for (index, point) in points.enumerated() {
                let timeOffset = interval * Double(index)
                let timestamp = run.date.addingTimeInterval(timeOffset)
                let currentDist = distInterval * Double(index)
                
                tcx += """
                
                  <Trackpoint>
                    <Time>\(df.string(from: timestamp))</Time>
                    <Position>
                      <LatitudeDegrees>\(point.lat)</LatitudeDegrees>
                      <LongitudeDegrees>\(point.lon)</LongitudeDegrees>
                    </Position>
                    <AltitudeMeters>0</AltitudeMeters>
                    <DistanceMeters>\(String(format: "%.2f", currentDist))</DistanceMeters>
                    <HeartRateBpm>
                      <Value>\(Int(run.avgHeartRate))</Value>
                    </HeartRateBpm>
                    <Cadence>\(Int(run.avgCadence ?? 0))</Cadence>
                  </Trackpoint>
                """
            }
        }
        
        tcx += """
        
                </Track>
              </Lap>
            </Activity>
          </Activities>
        </TrainingCenterDatabase>
        """
        
        return tcx
    }
    
    // MARK: - FIT Generation
    // Uses Garmin's official FIT Swift SDK
    // 
    // SETUP INSTRUCTIONS:
    // 1. Add Swift Package: https://github.com/garmin/fit-swift-sdk.git
    // 2. Import FITSwiftSDK in this file
    // 3. The SDK provides Encoder, FileIdMesg, RecordMesg, etc.
#if canImport(FITSwiftSDK)
    static func generateFIT(run: Run) -> Data? {
        do {
            // DateTime uses seconds since UTC 00:00 Dec 31 1989
            // FIT epoch: Dec 31, 1989 00:00:00 UTC = 631065600 seconds since Unix epoch
            let fitEpoch: TimeInterval = 631065600
            let secondsSinceFitEpoch = run.date.timeIntervalSince1970 - fitEpoch
            guard secondsSinceFitEpoch >= 0 else {
                print("Run date is before FIT epoch")
                return nil
            }
            let startTime = DateTime(timestamp: UInt32(secondsSinceFitEpoch))
            let semicirclesPerDegree: Double = 11930464.711111111 // Conversion factor

            // Create encoder
            let encoder = Encoder()
            var messages: [Mesg] = []

            // Timer Event Start (BEST PRACTICE)
            let eventStart = EventMesg()
            try eventStart.setTimestamp(startTime)
            try eventStart.setEvent(.timer)
            try eventStart.setEventType(.start)
            messages.append(eventStart)

            // File ID Message (REQUIRED)
            let fileIdMesg = FileIdMesg()
            try fileIdMesg.setType(.activity)
            try fileIdMesg.setManufacturer(.development)
            try fileIdMesg.setProduct(0) // Kinetix app
            try fileIdMesg.setTimeCreated(startTime)
            try fileIdMesg.setSerialNumber(UInt32.random(in: 1..<UInt32.max))
            encoder.write(mesg: fileIdMesg)

            // Device Info (BEST PRACTICE)
            let deviceInfo = DeviceInfoMesg()
            try deviceInfo.setDeviceIndex(DeviceIndexValues.creator)
            try deviceInfo.setManufacturer(.development)
            try deviceInfo.setProduct(0)
            try deviceInfo.setProductName("Kinetix")
            try deviceInfo.setSoftwareVersion(1.0)
            try deviceInfo.setTimestamp(startTime)
            encoder.write(mesg: deviceInfo)

            // Record Messages (track points)
            let points = run.routeData
            let count = points.count

            if count > 0 {
                let duration = run.duration
                let interval = duration / Double(count)
                let distInterval = run.distance / Double(count)

                for (index, point) in points.enumerated() {
                    let timeOffset = interval * Double(index)
                    let timestamp = DateTime(timestamp: UInt32(startTime.timestamp + UInt32(timeOffset)))
                    let currentDist = distInterval * Double(index)

                    let recordMesg = RecordMesg()
                    try recordMesg.setTimestamp(timestamp)

                    // Convert lat/lon to semicircles (FIT format)
                    let latSemicircles = Int32(round(point.lat * semicirclesPerDegree))
                    let lonSemicircles = Int32(round(point.lon * semicirclesPerDegree))
                    try recordMesg.setPositionLat(latSemicircles)
                    try recordMesg.setPositionLong(lonSemicircles)

                    try recordMesg.setDistance(Float64(currentDist))
                    try recordMesg.setHeartRate(UInt8(run.avgHeartRate))
                    if let cadence = run.avgCadence {
                        try recordMesg.setCadence(UInt8(cadence))
                    }

                    messages.append(recordMesg)
                }
            }

            // Session Message (summary)
            let endTime = DateTime(timestamp: UInt32(startTime.timestamp + UInt32(run.duration)))
            let sessionMesg = SessionMesg()
            try sessionMesg.setTimestamp(endTime)
            try sessionMesg.setStartTime(startTime)
            try sessionMesg.setTotalElapsedTime(Float64(run.duration))
            try sessionMesg.setTotalTimerTime(Float64(run.duration))
            try sessionMesg.setTotalDistance(Float64(run.distance))
            try sessionMesg.setSport(.running)
            try sessionMesg.setSubSport(.generic)
            try sessionMesg.setAvgHeartRate(UInt8(run.avgHeartRate))
            try sessionMesg.setMaxHeartRate(UInt8(run.avgHeartRate))
            if let cadence = run.avgCadence {
                try sessionMesg.setAvgCadence(UInt8(cadence))
                try sessionMesg.setMaxCadence(UInt8(cadence))
            }
            messages.append(sessionMesg)

            // Lap Message
            let lapMesg = LapMesg()
            try lapMesg.setTimestamp(endTime)
            try lapMesg.setStartTime(startTime)
            try lapMesg.setTotalElapsedTime(Float64(run.duration))
            try lapMesg.setTotalTimerTime(Float64(run.duration))
            try lapMesg.setTotalDistance(Float64(run.distance))
            try lapMesg.setSport(.running)
            try lapMesg.setSubSport(.generic)
            try lapMesg.setEvent(.timer)
            try lapMesg.setEventType(.stop)
            messages.append(lapMesg)

            // Activity Message
            let activityMesg = ActivityMesg()
            try activityMesg.setTimestamp(endTime)
            try activityMesg.setTotalTimerTime(Float64(run.duration))
            try activityMesg.setNumSessions(1)
            try activityMesg.setType(.manual)
            try activityMesg.setEvent(.timer)
            try activityMesg.setEventType(.stop)
            let timezoneOffset = TimeZone.current.secondsFromGMT()
            try activityMesg.setLocalTimestamp(LocalDateTime(Int(endTime.timestamp) + timezoneOffset))
            messages.append(activityMesg)

            // Timer Event Stop
            let eventStop = EventMesg()
            try eventStop.setTimestamp(endTime)
            try eventStop.setEvent(.timer)
            try eventStop.setEventType(.stop)
            messages.append(eventStop)

            // Write all messages
            encoder.write(mesgs: messages)

            // Close encoder and get data
            let encodedData = encoder.close()
            return encodedData

        } catch {
            print("FIT encoding error: \(error)")
            return nil
        }
    }
#else
    static func generateFIT(run: Run) -> Data? {
        // FITSwiftSDK not available. Return nil to disable FIT export gracefully.
        return nil
    }
#endif
}
