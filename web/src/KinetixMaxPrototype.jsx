import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Timer, Activity, TrendingUp, Sparkles, X, Share2, Ruler, Zap, History, Settings, ChevronRight, Trash2, Save, Globe, Flag, ChevronDown, Heart, AlertTriangle, BookOpen, Info, Calculator } from 'lucide-react';

// --- LOGIC ENGINE & HOOKS ---

const GEMINI_API_KEY = "PASTE_KEY_HERE";

const useAICoach = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const analyzeRun = async (distance, pace, npi, target) => {
    if (GEMINI_API_KEY.includes("PASTE")) return;
    
    setIsAnalyzing(true);
    const prompt = `You are Kinetix AI. Analyze: Dist ${distance}km, Pace ${pace}, NPI ${Math.floor(npi)}, Target ${target}. JSON: { "title": "Scientific Title", "insight": "Feedback" }`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = JSON.parse(text);
        setAiResult(result);
      }
    } catch (error) {
      console.error("AI Error", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { isAnalyzing, aiResult, setAiResult, analyzeRun };
};

const useLocationManager = (targetNPI, unitSystem, physioMode) => {
  const [isRunning, setIsRunning] = useState(false);
  const [hasGPSFix, setHasGPSFix] = useState(false);
  const [liveNPI, setLiveNPI] = useState(0.0);
  const [totalDistance, setTotalDistance] = useState(0.0); // meters
  const [paceSeconds, setPaceSeconds] = useState(0.0); // seconds per km
  const [timeToBeat, setTimeToBeat] = useState(null);
  const [heartRate, setHeartRate] = useState(70.0);
  const [duration, setDuration] = useState(0); // seconds
  const [recommendedPace, setRecommendedPace] = useState(0.0);
  const [progress, setProgress] = useState(0.0);

  const timerRef = useRef(null);

  // Check GPS availability on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setHasGPSFix(true),
        () => setHasGPSFix(false),
        { timeout: 5000, maximumAge: 0 }
      );
    } else {
      // For web prototype, simulate GPS available
      setHasGPSFix(true);
    }
  }, []);

  const toggleTracking = () => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  };

  const start = () => {
    setIsRunning(true);
    setTotalDistance(0);
    setLiveNPI(0);
    setDuration(0);
    setProgress(0);
    
    // Simulate running
    timerRef.current = setInterval(() => {
      setDuration(d => {
        const newDuration = d + 0.1;
        
        // Simulate Heart Rate
        setHeartRate(140 + (newDuration * 0.1));
        
        // Simulate Distance (assuming steady pace for demo if no GPS)
        // Let's simulate a 5:00/km pace (3.33 m/s) for demo purposes since we don't have real GPS in browser consistently without movement
        // Or better, just update calculations based on simulated movement
        setTotalDistance(dist => dist + 0.35); // ~3.5m/s

        return newDuration;
      });
    }, 100);
  };

  const stop = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Calculation Effect
  useEffect(() => {
    if (totalDistance > 0) {
      // Avg Pace (sec/km)
      const currentPaceSeconds = duration / (totalDistance / 1000.0);
      setPaceSeconds(currentPaceSeconds);

      // Rec Pace
      setRecommendedPace(currentPaceSeconds + 30.0);

      if (totalDistance > 50) {
        // NPI Formula
        const speedKmH = (1000 / currentPaceSeconds) * 3.6;
        const factor = Math.pow((totalDistance / 1000.0), 0.06);
        const npi = speedKmH * factor * 10.0;
        setLiveNPI(npi);

        // Check if target has already been reached
        if (npi >= targetNPI) {
          setTimeToBeat("TARGET REACHED!");
          setProgress(1.0);
        } else {
          // Projection Logic (recalculate when targetNPI changes)
          const roundingThreshold = targetNPI - 0.5;
          const term = 10 * ((roundingThreshold * (duration / 60) / (totalDistance / 1000)) / 500 - 1);

          if (term < 5) {
            const distNeeded = Math.exp(term) - 0.1;
            const distRemaining = distNeeded - (totalDistance / 1000.0);

            if (distRemaining > 0) {
              const timeSecs = distRemaining * currentPaceSeconds;
              const m = Math.floor(timeSecs / 60);
              const s = Math.floor(timeSecs % 60);
              
              const paceMin = Math.floor(currentPaceSeconds / 60);
              const paceSec = Math.floor(currentPaceSeconds % 60);
              
              setTimeToBeat(`${m}:${s.toString().padStart(2, '0')} @ AVG ${paceMin}:${paceSec.toString().padStart(2, '0')}`);
              
              // Calculate Progress (Elapsed Time / Total Expected Time)
              // This will update immediately when targetNPI changes
              const totalExpectedTime = duration + timeSecs;
              setProgress(totalExpectedTime > 0 ? duration / totalExpectedTime : 0);
            } else {
              setTimeToBeat("TARGET REACHED!");
              setProgress(1.0);
            }
          } else {
            setTimeToBeat("INCREASE PACE");
            // Reset progress to near-zero when pace is too slow to hit target
            setProgress(0.02);
          }
        }
      } else {
        // During initial calibration (first 50m), keep progress at 0
        setProgress(0);
        setTimeToBeat(null);
      }
    } else {
      // No distance yet, reset progress
      setProgress(0);
      setTimeToBeat(null);
    }
  }, [duration, totalDistance, targetNPI]);

  const formattedPace = () => {
    const pace = unitSystem === "metric" ? paceSeconds : paceSeconds * 1.60934;
    if (!isFinite(pace) || isNaN(pace)) return "0:00";
    return `${Math.floor(pace / 60)}:${Math.floor(pace % 60).toString().padStart(2, '0')}`;
  };

  const formattedDistance = () => {
    const dist = unitSystem === "metric" ? totalDistance / 1000 : (totalDistance / 1000) * 0.621371;
    return dist.toFixed(2);
  };

    const recommendedPaceString = () => {
        const pace = unitSystem === "metric" ? recommendedPace : recommendedPace * 1.60934;
        if (!isFinite(pace) || isNaN(pace)) return "0:00";
        return `${Math.floor(pace / 60)}:${Math.floor(pace % 60).toString().padStart(2, '0')}`;
    };

  return {
    isRunning,
    hasGPSFix,
    liveNPI,
    formattedPace,
    formattedDistance,
    toggleTracking,
    timeToBeat,
    heartRate,
    recommendedPaceString,
    progress
  };
};

// --- COMPONENTS ---

const StatBox = ({ title, value, color }) => (
  <div className="flex flex-col items-center justify-center glass rounded-xl p-3 flex-1 shadow-lg shadow-black/50 border border-white/5">
    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{title}</span>
    <span className={`text-2xl font-black font-mono tracking-tight`} style={{ color }}>{value}</span>
  </div>
);

const FireworksView = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50 pointer-events-none">
        <div className="text-7xl animate-bounce drop-shadow-2xl">🎉</div>
    </div>
);

const ManualCard = ({ icon: Icon, color, title, desc }) => (
    <div className="glass p-4 rounded-2xl shadow-xl shadow-black/30 border border-white/10 hover:border-white/20 transition-all duration-300">
        <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                <Icon size={14} color={color} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xs text-white tracking-wide">{title}</span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed font-medium">{desc}</p>
    </div>
);

// --- MAIN APP ---

const KinetixMaxPrototype = () => {
  const [targetNPI, setTargetNPI] = useState(135.0);
  const [unitSystem, setUnitSystem] = useState("metric");
  const [physioMode, setPhysioMode] = useState(false);
  const [showFindTarget, setShowFindTarget] = useState(false);
  const [findTargetDistance, setFindTargetDistance] = useState("");
  const [findTargetUnit, setFindTargetUnit] = useState("metric");
  const [findTargetTime, setFindTargetTime] = useState(""); // Format: "MM:SS"
  const [findTargetDate, setFindTargetDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [runHistory, setRunHistory] = useState([]);
  
  const { isRunning, hasGPSFix, liveNPI, formattedPace, formattedDistance, toggleTracking, timeToBeat, heartRate, recommendedPaceString, progress } = useLocationManager(targetNPI, unitSystem, physioMode);
  const { isAnalyzing, aiResult, setAiResult, analyzeRun } = useAICoach();
  
  const [showFireworks, setShowFireworks] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [showPhysioAlert, setShowPhysioAlert] = useState(false);

  // Winning Logic - Only celebrate when actually reaching or exceeding target
  useEffect(() => {
    if (liveNPI >= targetNPI && !hasCelebrated && isRunning && liveNPI > 0) {
        setHasCelebrated(true);
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 4000);
    }
  }, [liveNPI, targetNPI, hasCelebrated, isRunning]);

  // Physio Alert Logic
  useEffect(() => {
      if (physioMode && heartRate > 175 && !showPhysioAlert) {
          setShowPhysioAlert(true);
      }
  }, [heartRate, physioMode, showPhysioAlert]);

  // Reset celebration on stop
  useEffect(() => {
      if (!isRunning) setHasCelebrated(false);
  }, [isRunning]);

  // Calculate NPI from race data
  const calculateNPIFromRace = (distance, timeString, unit) => {
    // Convert distance to km
    const distanceKm = unit === "metric" ? parseFloat(distance) : parseFloat(distance) * 1.60934;
    
    // Parse time string (MM:SS)
    const [minutes, seconds] = timeString.split(':').map(Number);
    const timeInSeconds = minutes * 60 + seconds;
    
    // Calculate pace (seconds per km)
    const paceSeconds = timeInSeconds / distanceKm;
    
    // NPI Formula (same as in useLocationManager)
    const speedKmH = (1000 / paceSeconds) * 3.6;
    const factor = Math.pow(distanceKm, 0.06);
    const npi = speedKmH * factor * 10.0;
    
    return npi;
  };

  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Handle date selection
  const handleDateSelect = () => {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setFindTargetDate(dateStr);
    setShowDatePicker(false);
  };

  // Handle Find Target NPI
  const handleFindTarget = () => {
    if (!findTargetDistance || !findTargetTime || !findTargetDate) {
      alert("Please fill in all fields");
      return;
    }
    
    const calculatedNPI = calculateNPIFromRace(findTargetDistance, findTargetTime, findTargetUnit);
    setTargetNPI(calculatedNPI);
    
    // Add to history
    const historyEntry = {
      id: Date.now(),
      date: findTargetDate,
      distance: parseFloat(findTargetDistance),
      unit: findTargetUnit,
      time: findTargetTime,
      npi: calculatedNPI,
      type: "race"
    };
    setRunHistory([...runHistory, historyEntry]);
    
    // Reset form and close modal
    setFindTargetDistance("");
    setFindTargetTime("");
    setFindTargetDate("");
    setShowFindTarget(false);
  };

  const renderContent = () => {
      return (
          <div className="snap-y snap-mandatory h-full overflow-y-scroll no-scrollbar">
              {/* PAGE 1: RUN DASHBOARD */}
              <div className="snap-start h-full w-full relative flex flex-col p-2 pb-4">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-[11px] font-black italic tracking-wider text-white/90">KINETIX</span>
                      <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isRunning 
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                              : hasGPSFix 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
                      }`}>
                          {isRunning ? 'LIVE' : hasGPSFix ? 'READY' : 'WAITING'}
                      </div>
                  </div>

                  {/* Main Gauge Area */}
                  <div className="flex flex-col items-center relative py-2">
                      {/* TARGET Label - Above Dial */}
                      <div className="mb-2 z-10">
                          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full glass border border-cyan-500/20 shadow-lg">
                              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">TARGET</span>
                              <span className="text-sm font-black text-cyan-400">{Math.round(targetNPI)}</span>
                          </div>
                      </div>

                      {/* Progress Circle (Simulated with CSS/SVG) */}
                      <div className="relative flex items-center justify-center mb-2">
                          <svg className="w-40 h-40 transform -rotate-90 drop-shadow-2xl">
                              <defs>
                                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor={liveNPI >= targetNPI ? "#4ade80" : "#22d3ee"} />
                                      <stop offset="100%" stopColor={liveNPI >= targetNPI ? "#16a34a" : "#06b6d4"} />
                                  </linearGradient>
                              </defs>
                              <circle cx="80" cy="80" r="70" stroke="#1a1a1a" strokeWidth="8" fill="transparent" opacity="0.5" />
                              <circle 
                                cx="80" cy="80" r="70" 
                                stroke="url(#progressGradient)" 
                                strokeWidth="7" 
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 70}
                                strokeDashoffset={2 * Math.PI * 70 * (1 - Math.min(Math.max(progress, 0), 1))}
                                className="transition-all duration-700 ease-out"
                                strokeLinecap="round"
                                style={{ filter: `drop-shadow(0 0 8px ${liveNPI >= targetNPI ? 'rgba(34, 197, 94, 0.5)' : 'rgba(6, 182, 212, 0.5)'})` }}
                              />
                          </svg>
                          
                          {/* NPI Value - Centered in Dial */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className={`text-5xl font-black italic tracking-tight drop-shadow-2xl ${liveNPI >= targetNPI ? 'text-green-400' : 'text-white'}`}>
                                  {Math.floor(liveNPI)}
                              </span>
                          </div>
                      </div>

                      {/* INDEX Label - Below Dial */}
                      <div className="flex flex-col items-center z-10 space-y-1.5">
                          <span className="text-[9px] font-bold tracking-[0.3em] text-gray-400 uppercase">INDEX</span>

                          {isRunning && timeToBeat && (
                              <div className={`flex items-center gap-1.5 glass px-3 py-1.5 rounded-xl border shadow-lg ${timeToBeat.includes("REACHED") ? "border-green-500/30" : "border-orange-500/30"}`}>
                                  <Flag size={10} className={timeToBeat.includes("REACHED") ? "text-green-400" : "text-orange-400"} strokeWidth={2.5} />
                                  <span className={`text-[10px] font-mono font-bold ${timeToBeat.includes("REACHED") ? "text-green-400" : "text-orange-400"}`}>
                                      {timeToBeat}
                                  </span>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Runner Track */}
                  {isRunning && (
                    <div className="w-full h-8 relative mb-2 px-1">
                        <div className="absolute top-1/2 left-1 right-1 h-1.5 bg-gray-900/50 rounded-full transform -translate-y-1/2 shadow-inner" />
                        <div 
                            className="absolute top-1/2 left-1 h-1.5 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full transform -translate-y-1/2 transition-all duration-500 ease-out shadow-lg shadow-cyan-500/30"
                            style={{ width: `calc(${Math.min(Math.max(progress, 0), 1.0) * 100}% - 8px)` }}
                        />
                        <div 
                            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out text-xl scale-x-[-1] drop-shadow-lg filter"
                            style={{ left: `calc(${Math.min(Math.max(progress, 0), 1.0) * 100}% + 4px)` }}
                        >
                            🏃
                        </div>
                        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 text-sm drop-shadow-lg">🏁</div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="flex gap-1 mb-2">
                      <StatBox title="PACE" value={formattedPace()} color="#22d3ee" />
                      {physioMode && (
                          <StatBox 
                            title="BPM" 
                            value={Math.floor(heartRate)} 
                            color={heartRate > 170 ? "#ef4444" : "#ffffff"} 
                          />
                      )}
                      <StatBox title="DIST" value={formattedDistance()} color="#c084fc" />
                  </div>

                  {/* Control Button */}
                  <div className="flex flex-col items-center gap-2 mt-1">
                      <button 
                          onClick={toggleTracking}
                          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${
                              isRunning 
                                  ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-red-500/50' 
                                  : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-green-500/50'
                          }`}
                      >
                          {isRunning ? <Square fill="white" size={22} strokeWidth={0} /> : <Play fill="white" size={26} className="ml-1" strokeWidth={0} />}
                      </button>

                      {/* AI Coach Button (Only when stopped and has data) */}
                      {!isRunning && liveNPI > 0 && (
                         <button 
                           onClick={() => analyzeRun(formattedDistance(), formattedPace(), liveNPI, targetNPI)}
                           className="flex items-center gap-2 glass px-4 py-2 rounded-full text-[10px] font-bold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-300 shadow-lg"
                         >
                           <Sparkles size={12} strokeWidth={2.5} />
                           ASK AI COACH
                         </button>
                      )}
                  </div>
              </div>

              {/* PAGE 2: SETTINGS */}
              <div className="snap-start h-full w-full p-4 space-y-5 overflow-y-auto">
                   <h2 className="text-base font-black text-cyan-400 mb-4 text-center tracking-wide uppercase">Settings</h2>
                   
                   <div className="space-y-2">
                       <h3 className="text-[10px] font-bold text-gray-500 uppercase">Goals</h3>
                       <div className="glass p-4 rounded-2xl shadow-xl border border-white/10 flex flex-col gap-3">
                           <div className="flex justify-between items-center w-full">
                               <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Target NPI</span>
                               <span className="font-mono font-black text-cyan-400 text-lg">{Math.round(targetNPI)}</span>
                           </div>
                           <div className="flex justify-between items-center gap-2">
                               <button onClick={() => setTargetNPI(n => Math.max(0, n-5))} className="flex-1 h-10 bg-gray-900/50 rounded-xl flex items-center justify-center text-[11px] font-bold text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 hover:border-gray-600 transition-all duration-200 active:scale-95 shadow-lg">--</button>
                               <button onClick={() => setTargetNPI(n => Math.max(0, n-1))} className="flex-1 h-10 bg-gray-900/50 rounded-xl flex items-center justify-center text-base font-bold text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 hover:border-gray-600 transition-all duration-200 active:scale-95 shadow-lg">-</button>
                               <button onClick={() => setTargetNPI(n => n+1)} className="flex-1 h-10 bg-gray-900/50 rounded-xl flex items-center justify-center text-base font-bold text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 hover:border-gray-600 transition-all duration-200 active:scale-95 shadow-lg">+</button>
                               <button onClick={() => setTargetNPI(n => n+5)} className="flex-1 h-10 bg-gray-900/50 rounded-xl flex items-center justify-center text-[11px] font-bold text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 hover:border-gray-600 transition-all duration-200 active:scale-95 shadow-lg">++</button>
                           </div>
                           <button 
                               onClick={() => setShowFindTarget(true)}
                               className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 hover:from-cyan-500/30 hover:to-cyan-600/30 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-400 transition-all duration-200 shadow-lg"
                           >
                               Find my target NPI
                           </button>
                       </div>
                       <div className="glass p-4 rounded-2xl shadow-xl border border-white/10 flex justify-between items-center">
                           <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Physio-Pacer</span>
                           <button 
                               onClick={() => setPhysioMode(!physioMode)}
                               className={`w-12 h-6 rounded-full transition-all duration-300 relative shadow-lg ${physioMode ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gray-800'}`}
                           >
                               <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-lg ${physioMode ? 'left-7' : 'left-1'}`} />
                           </button>
                       </div>
                   </div>

                   <div className="space-y-2">
                       <h3 className="text-[10px] font-bold text-gray-500 uppercase">System</h3>
                       <div className="glass p-4 rounded-2xl shadow-xl border border-white/10 flex justify-between items-center">
                           <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Units</span>
                           <select 
                               value={unitSystem} 
                               onChange={(e) => setUnitSystem(e.target.value)}
                               className="bg-gray-900/50 text-white text-xs p-2 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none shadow-lg"
                           >
                               <option value="metric">Metric</option>
                               <option value="imperial">Imperial</option>
                           </select>
                       </div>
                   </div>
              </div>

              {/* PAGE 3: HISTORY */}
              <div className="snap-start h-full w-full p-3 overflow-y-auto">
                  <h2 className="text-sm font-bold text-purple-400 mb-4 text-center">HISTORY</h2>
                  {runHistory.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 mt-10">No runs recorded.</div>
                  ) : (
                      <div className="space-y-2">
                          {runHistory.map((run) => (
                              <div key={run.id} className="glass p-3 rounded-xl border border-white/10 shadow-lg">
                                  <div className="flex justify-between items-start mb-1">
                                      <div>
                                          <div className="text-xs font-bold text-white">{new Date(run.date).toLocaleDateString()}</div>
                                          <div className="text-[10px] text-gray-400">{run.distance} {run.unit === "metric" ? "km" : "mi"} • {run.time}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-sm font-black text-cyan-400">{Math.round(run.npi)}</div>
                                          <div className="text-[9px] text-gray-500 uppercase">NPI</div>
                                      </div>
                                  </div>
                                  {run.type === "race" && (
                                      <div className="text-[9px] text-cyan-400/70 mt-1">🏆 Best Race</div>
                                  )}
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {/* PAGE 4: MANUAL */}
              <div className="snap-start h-full w-full p-3 pb-10 overflow-y-auto">
                  <div className="flex items-center justify-center gap-2 mb-4">
                      <BookOpen className="text-cyan-400" size={16} />
                      <h2 className="text-sm font-bold">QUICK INFO</h2>
                  </div>
                  
                  <div className="space-y-3">
                      <ManualCard 
                          icon={Activity} 
                          color="#22d3ee" 
                          title="WHAT IS NPI?" 
                          desc="Normalized Performance Index. Speed adjusted for fatigue over distance." 
                      />
                      <ManualCard 
                          icon={Flag} 
                          color="#f97316" 
                          title="DYNAMIC FINISH" 
                          desc="The time shown is how long to beat your Target if you hold current pace." 
                      />
                      <ManualCard 
                          icon={Heart} 
                          color="#ef4444" 
                          title="PHYSIO-PACER" 
                          desc="Detects cardiac drift. If HR spikes while pace is flat, suggests recovery speed." 
                      />
                  </div>
                  
                  <div className="mt-6 text-center text-[10px] text-gray-600">
                      v1.0 • Kinetix Labs
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <div className="w-[410px] h-[502px] bg-gradient-to-br from-black via-gray-950 to-black text-white flex flex-col relative overflow-hidden font-sans select-none rounded-[48px] border-4 border-gray-800/50 shadow-2xl shadow-black/80">
            {/* Physio Alert */}
            {showPhysioAlert && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="glass border border-red-500/30 rounded-2xl p-5 w-full text-center shadow-2xl">
                        <AlertTriangle className="mx-auto text-red-400 mb-3" size={28} strokeWidth={2.5} />
                        <h3 className="text-base font-black mb-2 text-red-400">Cardiac Drift</h3>
                        <p className="text-xs text-gray-300 mb-5 font-medium">Efficiency dropping. Rec Pace: {recommendedPaceString()}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowPhysioAlert(false)} className="flex-1 py-2.5 bg-gray-900/50 rounded-xl text-gray-300 text-xs font-bold hover:bg-gray-800 border border-gray-700/50 transition-all duration-200">Ignore</button>
                            <button onClick={() => setShowPhysioAlert(false)} className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-red-600 rounded-xl text-white text-xs font-bold hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-500/30 transition-all duration-200">Okay</button>
                        </div>
                    </div>
                </div>
            )}

            {showFireworks && <FireworksView />}

            {/* Main Content - Vertical Page Scroll */}
            {renderContent()}

            {/* Date Picker Modal */}
            {showDatePicker && (
                <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="glass border border-cyan-500/30 rounded-2xl p-4 w-full max-w-sm shadow-2xl">
                        <h3 className="text-sm font-black text-cyan-400 mb-3 text-center">Select Date</h3>
                        
                        <div className="flex gap-2 mb-4">
                            {/* Year Picker */}
                            <div className="flex-1">
                                <label className="text-[9px] font-semibold text-gray-400 uppercase mb-1 block">Year</label>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-2 max-h-32 overflow-y-auto">
                                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                        <button
                                            key={year}
                                            onClick={() => {
                                                setSelectedYear(year);
                                                const daysInMonth = getDaysInMonth(year, selectedMonth);
                                                if (selectedDay > daysInMonth) setSelectedDay(daysInMonth);
                                            }}
                                            className={`w-full py-1.5 text-xs font-bold rounded transition-all ${
                                                selectedYear === year
                                                    ? 'bg-cyan-500/20 text-cyan-400'
                                                    : 'text-gray-300 hover:bg-gray-800'
                                            }`}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Month Picker */}
                            <div className="flex-1">
                                <label className="text-[9px] font-semibold text-gray-400 uppercase mb-1 block">Month</label>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-2 max-h-32 overflow-y-auto">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                        <button
                                            key={month}
                                            onClick={() => {
                                                setSelectedMonth(month);
                                                const daysInMonth = getDaysInMonth(selectedYear, month);
                                                if (selectedDay > daysInMonth) setSelectedDay(daysInMonth);
                                            }}
                                            className={`w-full py-1.5 text-xs font-bold rounded transition-all ${
                                                selectedMonth === month
                                                    ? 'bg-cyan-500/20 text-cyan-400'
                                                    : 'text-gray-300 hover:bg-gray-800'
                                            }`}
                                        >
                                            {month}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Day Picker */}
                            <div className="flex-1">
                                <label className="text-[9px] font-semibold text-gray-400 uppercase mb-1 block">Day</label>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-2 max-h-32 overflow-y-auto">
                                    {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1).map((day) => (
                                        <button
                                            key={day}
                                            onClick={() => setSelectedDay(day)}
                                            className={`w-full py-1.5 text-xs font-bold rounded transition-all ${
                                                selectedDay === day
                                                    ? 'bg-cyan-500/20 text-cyan-400'
                                                    : 'text-gray-300 hover:bg-gray-800'
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDatePicker(false)}
                                className="flex-1 py-2 bg-gray-900/50 rounded-xl text-gray-300 text-xs font-bold hover:bg-gray-800 border border-gray-700/50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDateSelect}
                                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl text-white text-xs font-bold hover:from-cyan-400 hover:to-cyan-500 shadow-lg transition-all"
                            >
                                Select
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Find Target NPI Modal */}
            {showFindTarget && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="glass border border-cyan-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <h3 className="text-base font-black text-cyan-400 mb-4 text-center tracking-wide">Find My Target NPI</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Distance</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={findTargetDistance}
                                        onChange={(e) => setFindTargetDistance(e.target.value)}
                                        placeholder="5.0"
                                        className="flex-1 bg-gray-900/50 text-white text-sm p-2.5 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                                    />
                                    <select
                                        value={findTargetUnit}
                                        onChange={(e) => setFindTargetUnit(e.target.value)}
                                        className="bg-gray-900/50 text-white text-xs p-2.5 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                                    >
                                        <option value="metric">km</option>
                                        <option value="imperial">mi</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Time (MM:SS)</label>
                                <input
                                    type="text"
                                    value={findTargetTime}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^\d:]/g, '');
                                        if (val.length <= 5 && /^\d{0,2}:?\d{0,2}$/.test(val)) {
                                            setFindTargetTime(val);
                                        }
                                    }}
                                    placeholder="20:00"
                                    className="w-full bg-gray-900/50 text-white text-sm p-2.5 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Date</label>
                                <button
                                    onClick={() => setShowDatePicker(true)}
                                    className="w-full bg-gray-900/50 text-white text-sm p-2.5 rounded-xl border border-gray-700/50 hover:border-cyan-500/50 focus:outline-none text-left"
                                >
                                    {findTargetDate || "Select Date"}
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => {
                                    setShowFindTarget(false);
                                    setFindTargetDistance("");
                                    setFindTargetTime("");
                                    setFindTargetDate("");
                                }}
                                className="flex-1 py-2.5 bg-gray-900/50 rounded-xl text-gray-300 text-xs font-bold hover:bg-gray-800 border border-gray-700/50 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFindTarget}
                                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl text-white text-xs font-bold hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/30 transition-all duration-200"
                            >
                                Calculate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Result Modal (Global) */}
            {(isAnalyzing || aiResult) && (
                <div className="absolute inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
                    {isAnalyzing ? (
                        <div className="animate-pulse text-cyan-400 font-mono text-xs">ANALYZING...</div>
                    ) : (
                        <div className="glass border border-cyan-500/30 rounded-2xl p-5 w-full max-h-full overflow-y-auto shadow-2xl">
                            <h3 className="text-base font-black text-cyan-400 mb-3 tracking-wide">{aiResult.title}</h3>
                            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3" />
                            <p className="text-xs text-gray-200 mb-5 leading-relaxed font-medium">{aiResult.insight}</p>
                            <button 
                                onClick={() => setAiResult(null)}
                                className="w-full py-2.5 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-white text-xs font-bold border border-gray-700/50 transition-all duration-200 shadow-lg"
                            >
                                CLOSE
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default KinetixMaxPrototype;

