import { resolveEntitlements } from "../src/resolveEntitlements";
import type { UserSubscription } from "../src/types";

const subscriptions: UserSubscription[] = [];
// Generate subscriptions
for (let i = 0; i < 5000; i++) {
  const isKinetix = i % 3 === 0;
  const isMyAssist = i % 3 === 1;
  const productKey = isKinetix ? "kinetix" : (isMyAssist ? "myassist" : "mychesscoach");

  subscriptions.push({
    subscriptionId: `sub_${i}`,
    productKey,
    planKey: "pro",
    status: "active",
  });
}

// Add some bundle subscriptions as well to exercise that code path
for (let i = 0; i < 1000; i++) {
  subscriptions.push({
    subscriptionId: `bundle_sub_${i}`,
    bundleKey: "bookiji_one",
    status: "active",
  });
}

const WARMUP_ITERATIONS = 5;
const BENCHMARK_ITERATIONS = 10;

// Warmup
for (let i = 0; i < WARMUP_ITERATIONS; i++) {
  resolveEntitlements(subscriptions);
}

const start = performance.now();
for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
  resolveEntitlements(subscriptions);
}
const end = performance.now();

const duration = end - start;
const msPerIteration = duration / BENCHMARK_ITERATIONS;

console.log(`resolveEntitlements Benchmark`);
console.log(`Total Subscriptions: ${subscriptions.length}`);
console.log(`Iterations: ${BENCHMARK_ITERATIONS}`);
console.log(`Total Duration: ${duration.toFixed(2)}ms`);
console.log(`Average Per Call: ${msPerIteration.toFixed(2)}ms`);
