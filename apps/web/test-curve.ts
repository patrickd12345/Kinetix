import { generateKps100Curve } from './src/lib/maxKpsPaceChart'

const profile = { age: 30, weightKg: 70 }

console.log("If PB KPS = 100:")
console.log(generateKps100Curve(100, profile, 'metric'))

console.log("If PB KPS = 743:")
console.log(generateKps100Curve(743, profile, 'metric'))
