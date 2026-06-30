import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order } from "../types";
import { 
  MapPin, Truck, Navigation, Play, Pause, RotateCcw, 
  Map, Compass, RefreshCw, Milestone, Clock, CheckCircle2,
  Layers, Gauge, ShieldCheck, Star, Award, Zap, Navigation2
} from "lucide-react";

interface LiveDeliveryMapProps {
  order: Order;
  role: "driver" | "customer" | "owner";
}

// Egypt coordinates for representation
const RESTAURANT_COORDS = { lat: 30.0444, lng: 31.2357, name: "المطعم الرئيسي 🏢" };
const CUSTOMER_COORDS = { lat: 30.0650, lng: 31.2780, name: "عنوان العميل 🏡" };

// intermediate waypoints to simulate real turn-by-turn road navigation
// This avoids straight-line teleportation and feels like a real Uber navigation!
const RIDE_WAYPOINTS = [
  { lat: 30.0444, lng: 31.2357, street: "شارع التحرير - وسط البلد 🛣️" },
  { lat: 30.0485, lng: 31.2422, street: "ميدان رمسيس / مطلع كوبري أكتوبر 🌉" },
  { lat: 30.0520, lng: 31.2510, street: "أعلى كوبري 6 أكتوبر - غمرة 🚗💨" },
  { lat: 30.0555, lng: 31.2612, street: "مجرى صلاح سالم - نفق العروبة 🛣️" },
  { lat: 30.0592, lng: 31.2705, street: "شارع الطيران - رابعة العدوية 📍" },
  { lat: 30.0650, lng: 31.2780, street: "شارع يوسف عباس - العميل 🏡" }
];

export default function LiveDeliveryMap({ order, role }: LiveDeliveryMapProps) {
  const [simulating, setSimulating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0); // 0 to 100%
  const [mapMode, setMapMode] = useState<"uber" | "satellite">("uber"); // Toggle between Uber Dark Tech and Satellite view
  const [currentSpeed, setCurrentSpeed] = useState(0); // Realtime dynamic Speed in km/h
  const [trafficDelay, setTrafficDelay] = useState("طريق سالك جداً 🟢 (دقيقتان توفير)");
  const [selectedVehicle, setSelectedVehicle] = useState<"moto" | "eco" | "delivery">("moto");
  const [currentStreetName, setCurrentStreetName] = useState("شارع التحرير - وسط البلد 🛣️");
  const [mapZoom, setMapZoom] = useState(13);

  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  // Driver metrics
  const driverLat = order.driverLat ?? RESTAURANT_COORDS.lat;
  const driverLng = order.driverLng ?? RESTAURANT_COORDS.lng;
  const driverStatus = order.driverStatus ?? "idle";

  // Simulate captain details like plate number and rating
  const captainDetails = {
    name: order.assignedTo?.name || "كابتن إسلام فود",
    rating: "4.92 ⭐",
    tripsCount: "1,420 رحلة سابقة",
    plateNumber: "ع م ج ٧ ٥ ٢ ٩",
    vehicle: selectedVehicle === "moto" ? "سكوتر بينيلي سريع 🏍️" : selectedVehicle === "eco" ? "هيونداي فيرنا 🚗" : "أوبر إكس دليفري 🚗",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" // Placeholder photo for captain
  };

  // Sync state and calculate intermediate points
  useEffect(() => {
    // Determine which way segment we are currently on based on progress
    const segmentCount = RIDE_WAYPOINTS.length - 1;
    const currentSegmentIndex = Math.min(
      segmentCount - 1,
      Math.floor((currentProgress / 100) * segmentCount)
    );
    
    if (RIDE_WAYPOINTS[currentSegmentIndex]) {
      setCurrentStreetName(RIDE_WAYPOINTS[currentSegmentIndex].street);
    }

    // Dynamic speed simulation
    if (simulating) {
      // Speed varies between 35 and 62 km/h
      const randomSpeed = Math.floor(Math.random() * 27) + 35;
      setCurrentSpeed(randomSpeed);

      // Randomly update traffic status
      const trafficStatuses = [
        "طريق سالك جداً 🟢 (دقيقتان توفير)",
        "زحام خفيف عند المحور 🟡 (+3 دقائق)",
        "طريق سريع وسلس 🟢",
        "توقف مؤقت عند إشارة صلاح سالم 🔴"
      ];
      if (Math.random() > 0.7) {
        setTrafficDelay(trafficStatuses[Math.floor(Math.random() * trafficStatuses.length)]);
      }
    } else {
      setCurrentSpeed(0);
    }
  }, [currentProgress, simulating]);

  // Handle clean up
  useEffect(() => {
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, []);

  const updateFirebaseCoordinates = async (lat: number, lng: number, status: Order["driverStatus"]) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        driverLat: Number(lat.toFixed(6)),
        driverLng: Number(lng.toFixed(6)),
        driverStatus: status
      });
    } catch (err) {
      console.error("Failed to sync live coordinates:", err);
    }
  };

  const startSimulation = () => {
    if (simulating) {
      stopSimulation();
      return;
    }

    setSimulating(true);
    let tempProgress = currentProgress >= 100 ? 0 : currentProgress;

    simulationInterval.current = setInterval(() => {
      tempProgress += 2.5; // Stretched to 40 ticks for incredibly smooth progression
      if (tempProgress >= 100) {
        tempProgress = 100;
        stopSimulation();
        updateFirebaseCoordinates(CUSTOMER_COORDS.lat, CUSTOMER_COORDS.lng, "delivered");
        setCurrentSpeed(0);
      } else {
        // Find accurate position along the waypoints
        const ratio = tempProgress / 100;
        const totalSegments = RIDE_WAYPOINTS.length - 1;
        const rawIndex = ratio * totalSegments;
        const currentSeg = Math.floor(rawIndex);
        const segmentRatio = rawIndex - currentSeg;

        const startPt = RIDE_WAYPOINTS[currentSeg];
        const endPt = RIDE_WAYPOINTS[currentSeg + 1];

        const nextLat = startPt.lat + (endPt.lat - startPt.lat) * segmentRatio;
        const nextLng = startPt.lng + (endPt.lng - startPt.lng) * segmentRatio;

        let status: Order["driverStatus"] = "picked_up";
        if (tempProgress > 80) {
          status = "approaching";
        }
        updateFirebaseCoordinates(nextLat, nextLng, status);
      }
      setCurrentProgress(tempProgress);
    }, 1000); // Tighter updates (every 1s) for real live feel!
  };

  const stopSimulation = () => {
    setSimulating(false);
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setCurrentSpeed(0);
  };

  const resetSimulation = () => {
    stopSimulation();
    setCurrentProgress(0);
    updateFirebaseCoordinates(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, "idle");
  };

  // Convert real Cairo coords into SVG percentages
  const getMapCoords = (lat: number, lng: number) => {
    // Bounding Box Cairo
    const latMin = 30.0350;
    const latMax = 30.0750;
    const lngMin = 31.2200;
    const lngMax = 31.2900;

    const x = ((lng - lngMin) / (lngMax - lngMin)) * 88 + 6;
    const y = 94 - (((lat - latMin) / (latMax - latMin)) * 88);

    return { x, y };
  };

  const restaurantPos = getMapCoords(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng);
  const customerPos = getMapCoords(CUSTOMER_COORDS.lat, CUSTOMER_COORDS.lng);
  const driverPos = getMapCoords(driverLat, driverLng);

  // Status text formatting
  const getStatusLabel = () => {
    switch (driverStatus) {
      case "idle": return "الكابتن يستعد لتحميل الطلبات بداخل المطبخ ⏳";
      case "picked_up": return "تم استلام الطلب وبدء مسار الرحلة السريع 🏍️💨";
      case "approaching": return "الكابتن على بعد خطوات قليلة من باب بيتك 🏁🔥";
      case "delivered": return "تم وصول الكابتن وتسليم الطلب بأمان 🎉";
      default: return "جاري الملاحة المباشرة نحو موقعك";
    }
  };

  // Remaining ETA Calculation
  const totalDistanceKm = 5.4;
  const remainingDistance = (totalDistanceKm * (100 - currentProgress) / 100).toFixed(2);
  const remainingMinutes = Math.ceil(12 * (100 - currentProgress) / 100);

  // Calculate rotation angle of the driver icon based on waypoint direction
  const getRotationAngle = () => {
    const totalSegments = RIDE_WAYPOINTS.length - 1;
    const currentSeg = Math.min(totalSegments - 1, Math.floor((currentProgress / 100) * totalSegments));
    const startPt = RIDE_WAYPOINTS[currentSeg];
    const endPt = RIDE_WAYPOINTS[currentSeg + 1] || startPt;

    const dLat = endPt.lat - startPt.lat;
    const dLng = endPt.lng - startPt.lng;
    const angleRad = Math.atan2(dLng, dLat);
    const angleDeg = (angleRad * 180) / Math.PI;
    
    return angleDeg; // Degree rotation
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl text-right font-sans overflow-hidden" id={`uber-live-map-${order.id}`}>
      
      {/* Dynamic Header - Uber branding style */}
      <div className="flex justify-between items-center flex-wrap gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          {/* Map Style Switches */}
          <button 
            type="button"
            onClick={() => setMapMode("uber")}
            className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${
              mapMode === "uber" 
                ? "bg-slate-800 text-white border border-slate-700" 
                : "bg-slate-900/50 text-slate-400 border border-transparent hover:text-slate-250"
            }`}
          >
            <Map className="w-3.5 h-3.5 text-orange-550" />
            <span>خارطة أوبر التقنية</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setMapMode("satellite")}
            className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${
              mapMode === "satellite" 
                ? "bg-orange-600 text-white border border-orange-500" 
                : "bg-slate-900/50 text-slate-400 border border-transparent hover:text-slate-250"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-white" />
            <span>قمر صناعي 🛰️</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xs font-black text-white flex items-center gap-1 justify-end">
              <span className="inline-block bg-emerald-500 w-2 h-2 rounded-full animate-ping"></span>
              خدمة أوبر كابتن لايف ⚡
            </span>
            <p className="text-[9px] text-slate-400">تتبع ذكي فائق الدقة بالقمر الصناعي</p>
          </div>
          <div className="w-8 h-8 bg-black border border-slate-800 rounded-xl flex items-center justify-center font-black text-sm text-orange-550 shadow-inner select-none">
            U
          </div>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/10] rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
        
        {/* Render Satellite Canvas Background or Neon Dark Uber Map */}
        {mapMode === "satellite" ? (
          /* SATELLITE VIEW SIMULATION - Earthy / dark green / topography curves and space grids */
          <div className="absolute inset-0 bg-radial from-slate-950 via-[#0a140d] to-[#010904] transition-all duration-500">
            {/* Satellite Topography representation */}
            <svg className="absolute inset-0 w-full h-full opacity-70" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="satGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#022c22" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#satGlow)" />

              {/* Topographical Curves representing building clusters and greens in Cairo */}
              <path d="M -50,150 C 100,50 200,300 450,120" fill="none" stroke="#064e3b" strokeWidth="2.5" className="opacity-40" />
              <path d="M -20,220 C 140,110 320,380 500,200" fill="none" stroke="#064e3b" strokeWidth="1.5" className="opacity-30" />
              <path d="M 120,-30 C 250,120 180,240 380,300" fill="none" stroke="#065f46" strokeWidth="2" strokeDasharray="5 3" className="opacity-20" />
              <path d="M 30,50 Q 150,130 310,80 T 490,210" fill="none" stroke="#022c22" strokeWidth="4" className="opacity-30" />

              {/* Simulated Nile River - satellite photo blue style */}
              <path 
                d="M 15,-20 C 35,40 55,80 70,140" 
                fill="none" 
                stroke="#0369a1" 
                strokeWidth="12" 
                strokeLinecap="round"
                className="opacity-45"
              />
              <path 
                d="M 15,-20 C 35,40 55,80 70,140" 
                fill="none" 
                stroke="#0284c7" 
                strokeWidth="4" 
                strokeLinecap="round"
                className="opacity-30"
              />

              {/* Satellite Scan Grid Lines */}
              <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />
              <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />
              <line x1="25%" y1="0" x2="25%" y2="100%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />
              <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#065f46" strokeWidth="0.5" className="opacity-25" />

              {/* Dynamic glowing satellite scanner radar swipe */}
              <line x1="0" y1="0" x2="100%" y2="100%" stroke="#10b981" strokeWidth="1" className="opacity-15 animate-pulse" />

              {/* Main Expressway roads representation */}
              <path d="M 5,20 Q 40,45 95,85" fill="none" stroke="#111827" strokeWidth="6" className="opacity-90" />
              <path d="M 5,20 Q 40,45 95,85" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" className="opacity-70" />

              {/* Actual route navigation line with glowing active path */}
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${customerPos.x},${customerPos.y}`}
                fill="none"
                stroke="#047857"
                strokeWidth="4"
                strokeLinecap="round"
                className="opacity-60"
              />
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${customerPos.x},${customerPos.y}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="6 3"
                className="opacity-95"
              />

              {/* Passed Route glowing trails */}
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${driverPos.x},${driverPos.y}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                className="shadow-md"
              />
            </svg>
          </div>
        ) : (
          /* UBER DARK TECH VIEW - Midnight Blue, Neon gold routes, High contrast */
          <div className="absolute inset-0 bg-slate-950 transition-all duration-500">
            <svg className="absolute inset-0 w-full h-full opacity-80" xmlns="http://www.w3.org/2000/svg">
              {/* Grid background */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" className="opacity-40" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Nile River representation */}
              <path 
                d="M 15,-20 C 35,40 55,80 70,140" 
                fill="none" 
                stroke="#1e3a8a" 
                strokeWidth="10" 
                strokeLinecap="round"
                className="opacity-50"
              />

              {/* Standard neighborhood grids in Cairo */}
              <path d="M 0,40 L 100,40" stroke="#0f172a" strokeWidth="1" className="opacity-80" />
              <path d="M 0,75 L 100,75" stroke="#0f172a" strokeWidth="1" className="opacity-80" />
              <path d="M 30,0 L 30,100" stroke="#0f172a" strokeWidth="1" className="opacity-80" />
              <path d="M 70,0 L 70,100" stroke="#0f172a" strokeWidth="1" className="opacity-80" />

              {/* Active navigation path - Golden/Neon Route Line */}
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${customerPos.x},${customerPos.y}`}
                fill="none"
                stroke="#334155"
                strokeWidth="4.5"
                strokeLinecap="round"
                className="opacity-70"
              />
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${customerPos.x},${customerPos.y}`}
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="opacity-90"
              />

              {/* Dynamic glowing active dot trail */}
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${driverPos.x},${driverPos.y}`}
                fill="none"
                stroke="#f97316"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d={`M ${restaurantPos.x},${restaurantPos.y} Q 40,40 ${driverPos.x},${driverPos.y}`}
                fill="none"
                stroke="#fb923c"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="4 2"
              />
            </svg>
          </div>
        )}

        {/* Cairo Neighborhood overlay text labels */}
        <div className="absolute top-[18%] left-[8%] text-[9px] text-slate-500 font-extrabold select-none bg-slate-950/40 px-1 py-0.5 rounded backdrop-blur-xs">محور 26 يوليو 🛣️</div>
        <div className="absolute bottom-[28%] right-[12%] text-[9px] text-slate-500 font-extrabold select-none bg-slate-950/40 px-1 py-0.5 rounded backdrop-blur-xs">طريق الأوتوستراد 🚙</div>
        <div className="absolute top-[42%] right-[25%] text-[9px] text-slate-500 font-extrabold select-none bg-slate-950/40 px-1 py-0.5 rounded backdrop-blur-xs">كوبري أكتوبر 🌉</div>

        {/* Restaurant Pin Marker */}
        <div 
          style={{ left: `${restaurantPos.x}%`, top: `${restaurantPos.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
        >
          <div className="bg-orange-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white transition transform hover:scale-110">
            <Truck className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[8px] bg-slate-950 text-orange-200 font-black px-1.5 py-0.5 rounded border border-orange-500/35 mt-1 whitespace-nowrap shadow-md">
            🏢 المطبخ الرئيسي
          </span>
        </div>

        {/* Customer Pin Marker */}
        <div 
          style={{ left: `${customerPos.x}%`, top: `${customerPos.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
        >
          <div className="bg-sky-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white transition transform hover:scale-110">
            <MapPin className="w-3.5 h-3.5 text-white animate-bounce" />
          </div>
          <span className="text-[8px] bg-slate-950 text-sky-200 font-black px-1.5 py-0.5 rounded border border-sky-500/35 mt-1 whitespace-nowrap shadow-md">
            🏡 منزل العميل (موقع التوصيل)
          </span>
        </div>

        {/* Rotating Animated Moving Captain Marker - Uber style with angle direction */}
        <div 
          style={{ left: `${driverPos.x}%`, top: `${driverPos.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30"
        >
          {/* Glowing pulse rings around driver */}
          <span className="absolute inline-flex h-11 w-11 rounded-full bg-emerald-500/20 animate-ping z-0"></span>
          <span className="absolute inline-flex h-7 w-7 rounded-full bg-emerald-400/30 animate-pulse z-0"></span>

          {/* Vehicle icon that rotates based on street angle */}
          <div 
            className="bg-emerald-500 text-slate-950 p-2.5 rounded-full shadow-2xl border-2 border-slate-950 z-10 flex items-center justify-center transition-all duration-300"
            style={{ transform: `rotate(${getRotationAngle()}deg)` }}
          >
            {selectedVehicle === "moto" ? (
              <Navigation2 className="w-4 h-4 fill-slate-950 text-slate-950" />
            ) : (
              <Navigation className="w-4 h-4 fill-slate-950 text-slate-950 rotate-45" />
            )}
          </div>

          <div className="text-[8px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-lg mt-1 whitespace-nowrap flex items-center gap-1 border border-emerald-300 z-20">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse"></span>
            <span>أوبر كابتن دليفري 🏍️</span>
          </div>
        </div>

        {/* Live Top HUD Panel - Speedometer, Street & Traffic Status (Desktop Only) */}
        <div className="absolute top-3 right-3 left-3 md:flex justify-between gap-2 z-10 pointer-events-none hidden">
          {/* Current street info */}
          <div className="bg-slate-950/90 border border-slate-800 p-2 rounded-xl shadow-lg backdrop-blur-md text-right max-w-[50%]">
            <span className="text-[8px] text-slate-400 block font-bold">الشارع الحالي:</span>
            <span className="text-[10px] text-orange-200 font-extrabold truncate block">{currentStreetName}</span>
          </div>

          {/* Speedometer & Traffic Indicator */}
          <div className="bg-slate-950/90 border border-slate-800 p-2 rounded-xl shadow-lg backdrop-blur-md text-right flex items-center gap-2">
            <div className="border-l border-slate-850 pl-2 text-center shrink-0">
              <span className="text-[8px] text-slate-400 block font-bold">السرعة</span>
              <span className="text-xs font-black font-mono text-emerald-400 flex items-center gap-0.5 justify-center">
                <Gauge className="w-3 h-3 text-emerald-400 shrink-0" />
                {currentSpeed} <span className="text-[8px]">كم/س</span>
              </span>
            </div>
            <div>
              <span className="text-[8px] text-slate-400 block font-bold text-right">كثافة المرور:</span>
              <span className="text-[9px] text-white font-extrabold block text-right">{trafficDelay}</span>
            </div>
          </div>
        </div>

        {/* Compact Mobile Top HUD Panel - Extremely sleek & unobtrusive */}
        <div className="absolute top-2 right-2 left-2 flex justify-between gap-1.5 z-10 pointer-events-none md:hidden">
          {/* Current Street Pill */}
          <div className="bg-slate-950/95 border border-slate-800 py-1.5 px-3 rounded-full shadow-lg backdrop-blur-md text-right max-w-[65%] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse"></span>
            <span className="text-[8.5px] text-orange-200 font-black truncate">{currentStreetName}</span>
          </div>

          {/* Speed pill */}
          <div className="bg-slate-950/95 border border-slate-800 py-1.5 px-3 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[9.5px] font-black font-mono text-emerald-400">{currentSpeed} <span className="text-[7.5px]">كم/س</span></span>
          </div>
        </div>

        {/* Live Bottom Left overlay for Ride Metrics (Desktop Only) */}
        <div className="absolute bottom-3 left-3 bg-slate-950/95 border border-slate-800 p-3 rounded-2xl space-y-2 max-w-[160px] shadow-2xl backdrop-blur-md z-10 hidden md:block">
          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-300 border-b border-slate-850 pb-1">
            <span className="font-extrabold font-mono text-orange-400">{remainingDistance} كم</span>
            <span className="text-slate-500 font-bold">المسافة:</span>
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-300 border-b border-slate-850 pb-1">
            <span className="font-extrabold font-mono text-emerald-400">~{remainingMinutes} دقيقة</span>
            <span className="text-slate-500 font-bold">الوصول ETA:</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8.5px] text-slate-400">
              <span>{Math.round(currentProgress)}%</span>
              <span>اكتمال الرحلة:</span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${currentProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Scale indicator inside map */}
        <div className="absolute bottom-3 right-3 bg-slate-950/70 text-[8px] font-mono text-slate-400 px-2 py-0.5 rounded border border-slate-800 pointer-events-none hidden sm:block">
          Cairo/EGY | Grid 250m
        </div>
      </div>

      {/* Mobile-only Metrics Grid - Replaces the map overlays beautifully on mobile viewports */}
      <div className="grid grid-cols-3 gap-2 md:hidden" dir="rtl">
        <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80 text-center flex flex-col justify-center items-center space-y-0.5">
          <span className="text-[8px] text-slate-400 block font-bold">المسافة المتبقية</span>
          <span className="text-[11px] font-black font-mono text-orange-400">{remainingDistance} كم</span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80 text-center flex flex-col justify-center items-center space-y-0.5">
          <span className="text-[8px] text-slate-400 block font-bold">الوصول المتوقع</span>
          <span className="text-[11px] font-black font-mono text-emerald-400">~{remainingMinutes} دقيقة</span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80 text-center flex flex-col justify-center items-center space-y-0.5">
          <span className="text-[8px] text-slate-400 block font-bold">اكتمال مسار الرحلة</span>
          <span className="text-[11px] font-black font-mono text-sky-400">{Math.round(currentProgress)}%</span>
        </div>
      </div>

      {/* Driver Status Text Message */}
      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-right space-y-1.5 shadow-sm">
        <span className="text-[9.5px] text-slate-400 font-bold">حالة التوصيل المباشرة:</span>
        <p className="text-xs font-black text-emerald-400 flex items-center justify-end gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{getStatusLabel()}</span>
        </p>
        <p className="text-[9.5px] text-slate-400 font-medium">
          إحداثيات تحديد المواقع (GPS): <span className="font-mono text-orange-400">{driverLat.toFixed(6)} N, {driverLng.toFixed(6)} E</span>
        </p>
      </div>

      {/* Uber Captain Profile Card */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-right">
        <div className="flex items-center gap-2">
          {/* Vehicle selection tag */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 font-mono text-slate-300">
              {captainDetails.plateNumber}
            </span>
            <span className="text-[9.5px] text-slate-500 font-extrabold">{captainDetails.vehicle}</span>
          </div>
        </div>

        {/* Mid block with Captain name & stars */}
        <div className="flex-1 space-y-1">
          <h4 className="text-xs font-extrabold text-white">{captainDetails.name}</h4>
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-amber-500 font-bold">
            <span>{captainDetails.tripsCount}</span>
            <span className="text-slate-650">•</span>
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              {captainDetails.rating}
            </span>
          </div>
        </div>

        {/* Circular Avatar */}
        <div className="w-10 h-10 rounded-full bg-slate-850 border border-slate-700 overflow-hidden shrink-0">
          <img 
            src={captainDetails.avatar} 
            alt={captainDetails.name} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover" 
          />
        </div>
      </div>

      {/* Map simulation controls - visible ONLY for driver role to drive and change coordinates */}
      {role === "driver" && (
        <div className="border-t border-slate-800 pt-4.5 space-y-3" dir="rtl">
          <div className="flex justify-between items-center bg-slate-950 px-3 py-2 rounded-xl border border-slate-850">
            <span className="text-[10px] font-black text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-orange-550" />
              لوحة تحكم الكابتن بمحاكاة السير والسرعة (Captain Controls)
            </span>
            {simulating && (
              <span className="text-[9px] bg-emerald-950 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-extrabold animate-pulse">
                الرحلة نشطة الآن...
              </span>
            )}
          </div>

          {/* Vehicle Select options inside simulation panel */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedVehicle("moto")}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition ${
                selectedVehicle === "moto"
                  ? "bg-orange-600/20 border-orange-500 text-orange-200"
                  : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300"
              }`}
            >
              <span>🏍️ أوبر موتو</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedVehicle("eco")}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition ${
                selectedVehicle === "eco"
                  ? "bg-orange-600/20 border-orange-500 text-orange-200"
                  : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300"
              }`}
            >
              <span>🚗 أوبر إكس</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedVehicle("delivery")}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition ${
                selectedVehicle === "delivery"
                  ? "bg-orange-600/20 border-orange-500 text-orange-200"
                  : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300"
              }`}
            >
              <span>📦 أوبر سكوتر</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={startSimulation}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-md transition duration-150 cursor-pointer ${
                simulating 
                  ? "bg-amber-600 hover:bg-amber-500 text-white" 
                  : "bg-emerald-650 hover:bg-emerald-600 text-white"
              }`}
            >
              {simulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{simulating ? "إيقاف السير" : "بدء السير 🏍️"}</span>
            </button>

            <button
              onClick={() => {
                const nextLat = CUSTOMER_COORDS.lat;
                const nextLng = CUSTOMER_COORDS.lng;
                updateFirebaseCoordinates(nextLat, nextLng, "delivered");
                setCurrentProgress(100);
                setCurrentSpeed(0);
              }}
              className="bg-sky-650 hover:bg-sky-600 text-white py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-md transition duration-150 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تسليم فوري 🎉</span>
            </button>

            <button
              onClick={resetSimulation}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition duration-150 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة تعيين</span>
            </button>
          </div>
          
          <p className="text-[8.5px] text-slate-400 leading-normal text-right">
            * اضغط على زر <strong>"بدء السير 🏍️"</strong> لكي تشاهد محاكاة حية لمسار الكابتن ينحني ويلتف مع مندرجات كوبري أكتوبر وطريق صلاح سالم وصولاً للعميل. ستلاحظ تغير زاوية السكوتر ديناميكياً مع انحناءات الشوارع!
          </p>
        </div>
      )}

    </div>
  );
}
