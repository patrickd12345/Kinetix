/**
 * Run data model matching the iOS SwiftData model
 */
export class Run {
  constructor({
    id = crypto.randomUUID(),
    date = new Date(),
    source = 'web',
    distance = 0, // meters
    duration = 0, // seconds
    avgPace = 0, // seconds per km
    kps = 0,
    setPb = false,
    avgHeartRate = 0,
    avgCadence = null,
    avgVerticalOscillation = null,
    avgGroundContactTime = null,
    avgStrideLength = null,
    formScore = null,
    routeData = [],
    formSessionId = null,
    elevationGain = null,
  } = {}) {
    this.id = id;
    this.date = date instanceof Date ? date : new Date(date);
    this.source = source;
    this.distance = distance;
    this.duration = duration;
    this.avgPace = avgPace;
    this.kps = kps;
    this.setPb = setPb;
    this.avgHeartRate = avgHeartRate;
    this.avgCadence = avgCadence;
    this.avgVerticalOscillation = avgVerticalOscillation;
    this.avgGroundContactTime = avgGroundContactTime;
    this.avgStrideLength = avgStrideLength;
    this.formScore = formScore;
    this.routeData = routeData;
    this.formSessionId = formSessionId;
    this.elevationGain = elevationGain;
  }

  toJSON() {
    return {
      ...this,
      date: this.date.toISOString(),
    };
  }

  static fromJSON(json) {
    return new Run({
      ...json,
      kps: json.kps ?? 0,
      setPb: json.setPb ?? json.set_pb ?? false,
      date: new Date(json.date),
    });
  }
}

export class RoutePoint {
  constructor(lat, lon) {
    this.lat = lat;
    this.lon = lon;
  }
}







