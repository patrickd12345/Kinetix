const baseline = 3654.43;
const optimized = 732.15;
const improvement = baseline - optimized;
const percentage = (improvement / baseline) * 100;
console.log(`Improvement: ${improvement.toFixed(2)} ms`);
console.log(`Percentage: ${percentage.toFixed(2)}%`);
