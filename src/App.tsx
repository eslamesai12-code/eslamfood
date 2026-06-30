import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { Restaurant, CallCenterMember } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Bell, Bot, X } from "lucide-react";

// Import modular screens
import LandingView from "./components/LandingView";
import OwnerDashboard from "./components/OwnerDashboard";
import AdminView from "./components/AdminView";
import CustomerRestaurantView from "./components/CustomerRestaurantView";
import InstallAppPrompt from "./components/InstallAppPrompt";
import CallCenterDashboard from "./components/CallCenterDashboard";
import DeliveryDashboard from "./components/DeliveryDashboard";

export default function App() {
  const [globalLanguage, setGlobalLanguage] = useState<"ar" | "en">(() => {
    try {
      const saved = localStorage.getItem("islamfood_global_language");
      if (saved === "ar" || saved === "en") return saved;
      const cookies = document.cookie.split("; ");
      const transCookie = cookies.find((row) => row.startsWith("googtrans="));
      if (transCookie && transCookie.includes("/ar/en")) {
        return "en";
      }
    } catch (e) {}
    return "ar";
  });

  const handleSetGlobalLanguage = (lang: "ar" | "en") => {
    setGlobalLanguage(lang);
    localStorage.setItem("islamfood_global_language", lang);
    if (lang === "en") {
      document.cookie = "googtrans=/ar/en; path=/; domain=" + window.location.hostname;
      document.cookie = "googtrans=/ar/en; path=/";
    } else {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    }
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    window.location.reload();
  };

  useEffect(() => {
    document.documentElement.dir = globalLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = globalLanguage;

    const scriptId = "google-translate-script";
    if (!document.getElementById(scriptId)) {
      const addScript = document.createElement("script");
      addScript.id = scriptId;
      addScript.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(addScript);
    }

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: "ar",
        includedLanguages: "en,ar",
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, "google_translate_element");
    };
  }, [globalLanguage]);

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Keep splash screen visible for 2200ms on first mount for premium branding feel
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const [view, setView] = useState<"landing" | "admin" | "owner_dashboard" | "customer_restaurant" | "call_center" | "delivery_app">(() => {
    const cachedMember = localStorage.getItem("islamfood_call_center_member");
    if (cachedMember) return "call_center";
    
    // Auto-detect delivery route on direct URL refresh
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === "/delivery" || hash === "#/delivery" || hash === "#delivery") {
      return "delivery_app";
    }
    return "landing";
  });
  const [activeCallCenterMember, setActiveCallCenterMember] = useState<CallCenterMember | null>(() => {
    try {
      const cached = localStorage.getItem("islamfood_call_center_member");
      if (cached) {
        return JSON.parse(cached) as CallCenterMember;
      }
    } catch (e) {
      console.warn("Could not load initial cached call center member", e);
    }
    return null;
  });
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  
  // 1. Initial State from Caching Layer to make the initial dashboard render near-instant!
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(() => {
    try {
      const cached = localStorage.getItem("islamfood_cached_restaurant_data");
      if (cached) {
        return JSON.parse(cached) as Restaurant;
      }
    } catch (e) {
      console.warn("Could not load initial cached restaurant", e);
    }
    return null;
  });

  const [connectionTested, setConnectionTested] = useState(false);
  
  // Keep restaurantFetched as true if we have local cached data, giving an instant load!
  const [restaurantFetched, setRestaurantFetched] = useState(() => {
    return localStorage.getItem("islamfood_cached_restaurant_data") !== null;
  });
  
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [routeTrigger, setRouteTrigger] = useState(0);

  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [activeBotTip, setActiveBotTip] = useState<string | null>(null);
  const [showNotificationAlert, setShowNotificationAlert] = useState(false);

  // Sync global settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "admin_settings", "global"), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    });
    return () => unsub();
  }, []);

  // Set up periodic automated tips and notifications bot
  useEffect(() => {
    if (!globalSettings || !globalSettings.botActive) return;
    const tipsList = globalSettings.botTips || [];
    if (tipsList.length === 0) return;

    // Run first notification after 15 seconds of app load if active to show off feature, then at configured interval
    const initialTimer = setTimeout(() => {
      const randomTip = tipsList[Math.floor(Math.random() * tipsList.length)];
      setActiveBotTip(randomTip);
      setShowNotificationAlert(true);
      
      // Play high-fidelity soft systems alert tone
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.04, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.12);
      } catch (err) {}

      setTimeout(() => {
        setShowNotificationAlert(false);
      }, 12000);
    }, 15000);

    const intervalMs = (globalSettings.botIntervalSeconds || 60) * 1000;
    const interval = setInterval(() => {
      const randomTip = tipsList[Math.floor(Math.random() * tipsList.length)];
      setActiveBotTip(randomTip);
      setShowNotificationAlert(true);

      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.04, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.12);
      } catch (err) {}

      setTimeout(() => {
        setShowNotificationAlert(false);
      }, 12000);
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [globalSettings]);

  // Support manual/immediate test dispatch
  useEffect(() => {
    const handleManualTip = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setActiveBotTip(detail);
        setShowNotificationAlert(true);

        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.connect(gain);
          gain.connect(context.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, context.currentTime);
          gain.gain.setValueAtTime(0.04, context.currentTime);
          osc.start();
          osc.stop(context.currentTime + 0.15);
        } catch (err) {}

        setTimeout(() => {
          setShowNotificationAlert(false);
        }, 12000);
      }
    };
    window.addEventListener("islamfood_new_tip_alert", handleManualTip);
    return () => window.removeEventListener("islamfood_new_tip_alert", handleManualTip);
  }, []);

  // Load call_center restaurant if authenticated as call_center member
  useEffect(() => {
    if (activeCallCenterMember && !activeRestaurant) {
      const docRef = doc(db, "restaurants", activeCallCenterMember.restaurantId);
      getDoc(docRef).then((snapshot) => {
        if (snapshot.exists()) {
          setActiveRestaurant(snapshot.data() as Restaurant);
        }
      }).catch((err) => {
        console.error("Failed to load call center restaurant:", err);
      });
    }
  }, [activeCallCenterMember, activeRestaurant]);

  // 1. Warm up connection and seed global settings in background (non-blocking)
  useEffect(() => {
    // Set connection as tested immediately so the UI loads without any blocking delays
    setConnectionTested(true);

    async function seedGlobalSettings() {
      try {
        const globalSettingsRef = doc(db, "admin_settings", "global");
        const docSnap = await getDoc(globalSettingsRef);
        if (!docSnap.exists()) {
          console.log("Seeding initial global administrator settings...");
          await setDoc(globalSettingsRef, {
            vodafoneCashNumber: "01000123456", // Default Vodafone Cash contact
            subscriptionFee: 250, // default Egyptian Pounds
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn("Global settings seeding skipped or currently offline", err);
      }
    }
    
    seedGlobalSettings();
  }, []);

  // 2. Sync Logged-in Auth and Restaurant Data using robust real-time subscription & user-specific caching
  useEffect(() => {
    let unsubRestaurant: (() => void) | null = null;

    // Fast recovery safety trigger: if snapshot doesn't resolve in 800ms, proceed to avoid sticking the user
    const safetyTimeout = setTimeout(() => {
      setRestaurantFetched(true);
    }, 800);

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      // Reset any previous restaurant listener
      if (unsubRestaurant) {
        unsubRestaurant();
        unsubRestaurant = null;
      }

      if (user) {
        setCurrentUserEmail(user.email);
        
        // 1. Try to fetch from user-specific cache immediately to avoid any flickering/blank screen
        const cacheKey = `islamfood_restaurant_cache_${user.uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Restaurant;
            setActiveRestaurant(parsed);
            setRestaurantFetched(true);
            // Save as current global active restaurant cache
            localStorage.setItem("islamfood_cached_restaurant_data", cached);
          } catch (err) {
            console.warn("Error parsing user-specific cache", err);
          }
        } else {
          // If no user-specific cache, check if global cached restaurant belongs to this UID
          const genericCache = localStorage.getItem("islamfood_cached_restaurant_data");
          if (genericCache) {
            try {
              const parsed = JSON.parse(genericCache) as Restaurant;
              if (parsed.ownerId === user.uid) {
                setActiveRestaurant(parsed);
                setRestaurantFetched(true);
              } else {
                setActiveRestaurant(null);
                setRestaurantFetched(false);
              }
            } catch (err) {
              setActiveRestaurant(null);
              setRestaurantFetched(false);
            }
          } else {
            setActiveRestaurant(null);
            setRestaurantFetched(false);
          }
        }

        const docRef = doc(db, "restaurants", user.uid);

        // Subscribing to the restaurant document
        unsubRestaurant = onSnapshot(
          docRef,
          async (snapshot) => {
            clearTimeout(safetyTimeout);
            if (snapshot.exists()) {
              const freshData = snapshot.data() as Restaurant;
              setActiveRestaurant(freshData);
              setRestaurantFetched(true);
              
              // Persist locally for instant future load
              const freshStr = JSON.stringify(freshData);
              localStorage.setItem(`islamfood_restaurant_cache_${user.uid}`, freshStr);
              localStorage.setItem("islamfood_cached_restaurant_data", freshStr);
            } else {
              // Fallback lookup: Search for restaurant by ownerEmail to heal provider UID mismatches
              try {
                if (user.email) {
                  const q = query(collection(db, "restaurants"), where("ownerEmail", "==", user.email));
                  const qSnap = await getDocs(q);
                  if (!qSnap.empty) {
                    const freshData = qSnap.docs[0].data() as Restaurant;
                    setActiveRestaurant(freshData);
                    setRestaurantFetched(true);
                    
                    const freshStr = JSON.stringify(freshData);
                    localStorage.setItem(`islamfood_restaurant_cache_${user.uid}`, freshStr);
                    localStorage.setItem("islamfood_cached_restaurant_data", freshStr);
                    return;
                  }
                }
              } catch (fallbackErr) {
                console.warn("ownerEmail lookup fallback failed:", fallbackErr);
              }

              // Automatically seed a restaurant profile for eslamesai12@gmail.com if it doesn't exist
              if (user.email === "eslamesai12@gmail.com") {
                const trialEnds = new Date();
                trialEnds.setDate(trialEnds.getDate() + 30);
                const demoRes: Restaurant = {
                  id: user.uid,
                  ownerId: user.uid,
                  ownerEmail: user.email || "",
                  name: "مطعم إسلام فود الرئيسي 👑",
                  phone: "01012345678",
                  address: "طنطا، بجوار بنك مصر، محافظة الغربية",
                  image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                  lat: 30.7885,
                  lng: 31.0004,
                  createdAt: new Date().toISOString(),
                  trialEndsAt: trialEnds.toISOString(),
                  subscriptionExpiresAt: trialEnds.toISOString(),
                  status: "active",
                };
                try {
                  await setDoc(docRef, demoRes);
                  setActiveRestaurant(demoRes);
                  const demoStr = JSON.stringify(demoRes);
                  localStorage.setItem(`islamfood_restaurant_cache_${user.uid}`, demoStr);
                  localStorage.setItem("islamfood_cached_restaurant_data", demoStr);
                } catch (setErr) {
                  console.error("Auto seeding failed:", setErr);
                }
              } else {
                setActiveRestaurant(null);
                localStorage.removeItem(`islamfood_restaurant_cache_${user.uid}`);
                localStorage.removeItem("islamfood_cached_restaurant_data");
              }
              setRestaurantFetched(true);
            }
          },
          (error) => {
            clearTimeout(safetyTimeout);
            console.warn("Restaurant snapshot state subscription warning:", error.message);
            // Fall back nicely to let application proceed with whatever cache was loaded
            setRestaurantFetched(true);
          }
        );
      } else {
        clearTimeout(safetyTimeout);
        setCurrentUserEmail(null);
        setActiveRestaurant(null);
        setRestaurantFetched(true);
        localStorage.removeItem("islamfood_cached_restaurant_data");
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubAuth();
      if (unsubRestaurant) {
        unsubRestaurant();
      }
    };
  }, []);

  // 3. Routing effect driven by complete synchronization states - Optimized to rely on boolean presence to prevent unnecessary re-runs
  const hasActiveRestaurant = !!activeRestaurant;
  const hasActiveCallCenterMember = !!activeCallCenterMember;
  useEffect(() => {
    if (!connectionTested || !restaurantFetched) return;

    const handleRouting = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      // Check Customer View Pathnames like /r/storeId
      if (path.startsWith("/r/")) {
        const rawId = path.split("/r/")[1];
        if (rawId) {
          const id = rawId.split("/")[0].split("?")[0].split("#")[0];
          setView("customer_restaurant");
          setCurrentStoreId(id);
          return;
        }
      }

      // Check Customer View Hash routes like #/r/storeId
      if (hash.startsWith("#/r/")) {
        const rawId = hash.split("#/r/")[1];
        if (rawId) {
          const id = rawId.split("/")[0].split("?")[0].split("#")[0];
          setView("customer_restaurant");
          setCurrentStoreId(id);
          return;
        }
      }

      if (path === "/delivery" || hash === "#/delivery" || hash === "#delivery") {
        setView("delivery_app");
        return;
      }

      if (hasActiveCallCenterMember) {
        setView("call_center");
      } else if (path === "/admin" || hash === "#/admin" || hash === "#admin") {
        setView("admin");
      } else if (path === "/dashboard" || hash === "#/dashboard" || hash === "#dashboard") {
        if (hasActiveRestaurant) {
          setView("owner_dashboard");
        } else {
          // No active restaurant profile, redirect to onboarding/landing
          setView("landing");
          window.history.replaceState({}, "", "/");
        }
      } else {
        // Normal Flow "/"
        if (hasActiveRestaurant) {
          setView("owner_dashboard");
          window.history.replaceState({}, "", "/dashboard");
        } else {
          setView("landing");
        }
      }
    };

    handleRouting();
    window.addEventListener("popstate", handleRouting);
    return () => {
      window.removeEventListener("popstate", handleRouting);
    };
  }, [connectionTested, restaurantFetched, hasActiveRestaurant, hasActiveCallCenterMember, routeTrigger]);

  const handleOnboardComplete = React.useCallback((restaurant: Restaurant) => {
    setActiveRestaurant(restaurant);
    const str = JSON.stringify(restaurant);
    localStorage.setItem(`islamfood_restaurant_cache_${restaurant.id}`, str);
    localStorage.setItem("islamfood_cached_restaurant_data", str);
    setView("owner_dashboard");
    window.history.pushState({}, "", "/dashboard");
    setRouteTrigger(prev => prev + 1);
  }, []);

  const handleLogout = React.useCallback(() => {
    auth.signOut();
    setActiveRestaurant(null);
    setRestaurantFetched(true);
    setView("landing");
    window.history.pushState({}, "", "/");
    localStorage.removeItem("islamfood_cached_restaurant_data");
    setRouteTrigger(prev => prev + 1);
  }, []);

  const handleNavigateToAdmin = React.useCallback(() => {
    setView("admin");
    window.history.pushState({}, "", "/admin");
    setRouteTrigger(prev => prev + 1);
  }, []);

  const handleNavigateHome = React.useCallback(() => {
    if (auth.currentUser && hasActiveRestaurant) {
      setView("owner_dashboard");
      window.history.pushState({}, "", "/dashboard");
    } else {
      setView("landing");
      window.history.pushState({}, "", "/");
    }
    setRouteTrigger(prev => prev + 1);
  }, [hasActiveRestaurant]);

  const handleCallCenterLogin = React.useCallback((member: CallCenterMember, restaurant: Restaurant) => {
    setActiveCallCenterMember(member);
    setActiveRestaurant(restaurant);
    localStorage.setItem("islamfood_call_center_member", JSON.stringify(member));
    localStorage.setItem("islamfood_cached_restaurant_data", JSON.stringify(restaurant));
    setView("call_center");
    setRouteTrigger(prev => prev + 1);
  }, []);

  const handleCallCenterLogout = React.useCallback(() => {
    setActiveCallCenterMember(null);
    setActiveRestaurant(null);
    localStorage.removeItem("islamfood_call_center_member");
    localStorage.removeItem("islamfood_cached_restaurant_data");
    setView("landing");
    setRouteTrigger(prev => prev + 1);
  }, []);

  const appInitializing = !connectionTested || (auth.currentUser !== null && !restaurantFetched);

  if (showSplash || appInitializing) {
    return (
      <div className="min-h-screen bg-[#fa5a00] flex flex-col items-center justify-center p-6 text-center select-none font-sans" id="brand-splash-screen animate-fade-in">
        <div className="space-y-6 flex flex-col items-center max-w-sm">
          {/* Circular Badge with Crossed Knife and Spoon */}
          <div className="w-28 h-28 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-950/30 border-4 border-white/20 animate-bounce duration-3000">
            <svg className="w-16 h-16 text-[#fa5a00]" viewBox="0 0 128 128" fill="currentColor">
              {/* Spoon Handle (diagonal bottom-left to top-right) */}
              <path d="M 28 100 L 58 70" stroke="#fa5a00" strokeWidth="11" strokeLinecap="round" />
              {/* Spoon Bowl */}
              <path d="M 54 74 C 47 59, 77 33, 97 33 C 107 33, 107 53, 92 68 C 77 83, 61 89, 54 74 Z" />
              
              {/* Knife Handle (diagonal bottom-right to top-left) */}
              <path d="M 100 100 L 70 70" stroke="#fa5a00" strokeWidth="11" strokeLinecap="round" />
              {/* Knife Blade */}
              <path d="M 33 33 C 43 33, 63 53, 73 73 L 53 73 L 33 53 Z" />
            </svg>
          </div>

          {/* Branding Texts */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-wide">
              إسلام فود
            </h1>
            <p className="text-xs md:text-sm font-semibold text-orange-100 italic tracking-wider opacity-90">
              عالم من المذاق بين يديك
            </p>
          </div>

          {/* Clean Progress/Spin state */}
          <div className="pt-8 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="text-[10px] text-orange-200/80 font-bold">جاري فحص الاتصال بالـ Cloud Server لـ إسلام فود...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render correct view wrapper
  return (
    <div className="w-full min-h-screen bg-slate-50" text-right="true">
      {view === "landing" && (
        <LandingView 
          onOnboardComplete={handleOnboardComplete} 
          onNavigateToAdmin={handleNavigateToAdmin} 
          onCallCenterLogin={handleCallCenterLogin}
          onNavigateToDelivery={() => {
            setView("delivery_app");
            window.history.pushState({}, "", "/delivery");
            setRouteTrigger(prev => prev + 1);
          }}
        />
      )}

      {view === "owner_dashboard" && activeRestaurant && (
        <OwnerDashboard 
          restaurant={activeRestaurant} 
          onLogout={handleLogout} 
          onNavigateToAdmin={handleNavigateToAdmin}
        />
      )}

      {view === "owner_dashboard" && !activeRestaurant && (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center font-sans">
          <div className="space-y-4 max-w-sm">
            <p className="text-xs text-slate-550 font-bold">जاري تحميل ملفات وتراخيص المطعم من فودافون كاش...</p>
            <button 
              onClick={handleLogout}
              className="text-xs text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 font-bold py-1.5 px-4 rounded-xl transition duration-150"
            >
              إلغاء والمحاولة مجدداً
            </button>
          </div>
        </div>
      )}

      {view === "admin" && (
        <AdminView 
          onNavigateHome={handleNavigateHome} 
          adminEmail={currentUserEmail}
          onEnterRestaurant={(store) => {
            setActiveRestaurant(store);
            localStorage.setItem("islamfood_cached_restaurant_data", JSON.stringify(store));
            setView("owner_dashboard");
            window.history.pushState({}, "", "/dashboard");
            setRouteTrigger(prev => prev + 1);
          }}
        />
      )}

      {view === "call_center" && activeCallCenterMember && activeRestaurant && (
        <CallCenterDashboard 
          member={activeCallCenterMember}
          restaurant={activeRestaurant}
          onLogout={handleCallCenterLogout}
        />
      )}

      {view === "customer_restaurant" && currentStoreId && (
        <CustomerRestaurantView 
          storeId={currentStoreId} 
        />
      )}

      {view === "delivery_app" && (
        <DeliveryDashboard 
          onLogout={() => {
            setView("landing");
            window.history.pushState({}, "", "/");
            setRouteTrigger(prev => prev + 1);
          }}
          onNavigateHome={handleNavigateHome}
        />
      )}

      {/* Dynamic Native PWA and Custom Installation Prompt for Android and iOS mobile devices */}
      <InstallAppPrompt />

      {/* Automated Bot Tips Push Notification Banner Simulator */}
      <AnimatePresence>
        {showNotificationAlert && activeBotTip && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 220 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[340px] sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] p-4 z-[9999] text-right pointer-events-auto"
            style={{ fontFamily: globalSettings?.platformFontFamily || "Cairo, sans-serif" }}
            dir="rtl"
          >
            <div className="flex items-start gap-3">
              {/* Left/Start Circle icon badge mirroring Screenshot 1 */}
              <div className="bg-orange-500 text-white p-2.5 rounded-2xl shadow-lg shadow-orange-500/20 shrink-0">
                <Bot className="w-5 h-5 animate-bounce" />
              </div>

              {/* Central text content block */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 font-sans tracking-wide">إسلام فود • بوت النصائح الذكي 🤖</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">💡 فكرة اليوم</span>
                    <span className="text-[9px] font-medium text-slate-500">الآن</span>
                  </div>
                </div>

                <p className="text-[11px] sm:text-xs font-black text-white leading-relaxed">
                  {activeBotTip}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowNotificationAlert(false)}
                className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Simulated progress timer bar on the bottom of the notification */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-b-3xl overflow-hidden">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 12, ease: "linear" }}
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Translate mounting point */}
      <div id="google_translate_element" className="hidden pointer-events-none opacity-0 w-0 h-0 absolute" />

      {/* Floating Global Language Switcher */}
      <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/80 p-1.5 rounded-full shadow-lg pointer-events-auto">
        <button
          onClick={() => handleSetGlobalLanguage("ar")}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer select-none ${
            globalLanguage === "ar"
              ? "bg-[#fa5a00] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          العربية 🇪🇬
        </button>
        <button
          onClick={() => handleSetGlobalLanguage("en")}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer select-none ${
            globalLanguage === "en"
              ? "bg-[#fa5a00] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          English 🇬🇧
        </button>
      </div>
    </div>
  );
}
