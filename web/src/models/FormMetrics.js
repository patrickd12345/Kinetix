/**
 * FormMetrics model matching the iOS FormMetrics struct
 */
export class FormMetrics {
  constructor({
    pace = null, // seconds per km
    distance = null, // meters
    cadence = null, // steps per minute
    heartRate = null, // beats per minute
    verticalOscillation = null, // centimeters
    strideLength = null, // meters
    groundContactTime = null, // milliseconds
    leftRightBalance = null, // percentage (left side share)
  } = {}) {
    this.pace = pace;
    this.distance = distance;
    this.cadence = cadence;
    this.heartRate = heartRate;
    this.verticalOscillation = verticalOscillation;
    this.strideLength = strideLength;
    this.groundContactTime = groundContactTime;
    this.leftRightBalance = leftRightBalance;
  }

  // Derived metrics
  get stepLength() {
    return this.strideLength ? this.strideLength / 2.0 : null;
  }

  get runningEfficiency() {
    if (!this.cadence || !this.verticalOscillation) return null;
    return this.cadence / (this.verticalOscillation + 1.0);
  }

  get legStiffness() {
    if (!this.cadence || !this.groundContactTime) return null;
    return this.cadence / (this.groundContactTime + 0.001);
  }

  get formScore() {
    const eff = this.runningEfficiency;
    const stiff = this.legStiffness;
    if (eff === null || stiff === null) return null;
    return Math.min(100, (eff * 0.6 + stiff * 0.4) * 10);
  }
}


