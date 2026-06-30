import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs,
  getDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order, Restaurant } from "../types";
import LiveDeliveryMap from "./LiveDeliveryMap";
import { 
  Truck, MapPin, Phone, Clock, Navigation, CheckCircle2, 
  XCircle, RotateCcw, LogOut, Check, AlertTriangle, 
  TrendingUp, Map, RefreshCw, ShoppingBag, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DeliveryDashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
}

interface DeliveryDriver {
  name: string;
  phone: string;
}

export default function DeliveryDashboard({ onLogout, onNavigateHome }: DeliveryDashboardProps) {
  const [driver, setDriver] = useState<DeliveryDriver | null>(() => {
    const cached = localStorage.getItem("islamfood_delivery_driver");
    if (cached) {
      try {
        return JSON.parse(cached) as DeliveryDriver;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [driverNameInput, setDriverNameInput] = useState("");
  const [driverPhoneInput, setDriverPhoneInput] = useState("");
  const [restaurantId, setRestaurantId] = useState<string>(() => {
    // Try to get from URL params first
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get("restaurantId");
    if (urlId) {
      localStorage.setItem("islamfood_delivery_restaurant_id", urlId);
      return urlId;
    }
    return localStorage.getItem("islamfood_delivery_restaurant_id") || "";
  });

  const [restaurantsList, setRestaurantsList] = useState<Restaurant[]>([]);
  const [selectedRes, setSelectedRes] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"available" | "my_active" | "my_completed">("available");
  const [errorMsg, setErrorMsg] = useState("");
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  // Hidden passcode gate states for Eslam Food Delivery
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [isPasscodeVerified, setIsPasscodeVerified] = useState(() => {
    return sessionStorage.getItem("islamfood_delivery_verified") === "true";
  });

  useEffect(() => {
    const sRef = doc(db, "admin_settings", "global");
    const unsub = onSnapshot(sRef, (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (err) => {
      console.warn("Failed to subscribe to global admin settings in DeliveryDashboard:", err);
    });
    return unsub;
  }, []);

  // Load all restaurants to allow the driver to choose one if none is pre-selected
  useEffect(() => {
    async function fetchRestaurants() {
      try {
        const q = query(collection(db, "restaurants"), where("status", "==", "active"));
        const snap = await getDocs(q);
        const list: Restaurant[] = [];
        snap.forEach((doc) => {
          list.push(doc.data() as Restaurant);
        });
        setRestaurantsList(list);
        
        // If we have restaurantId, find and set it
        if (restaurantId) {
          const found = list.find(r => r.id === restaurantId);
          if (found) {
            setSelectedRes(found);
          } else {
            // Fetch directly in case it is there but status query had edge cases
            const docRef = doc(db, "restaurants", restaurantId);
            const dSnap = await getDoc(docRef);
            if (dSnap.exists()) {
              const resData = dSnap.data() as Restaurant;
              setSelectedRes(resData);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching restaurants list:", err);
      }
    }
    fetchRestaurants();
  }, [restaurantId]);

  // Subscribe to Orders for the selected Restaurant
  useEffect(() => {
    if (!restaurantId) return;

    setLoading(true);
    // Subscribe to all delivery orders for this restaurant
    const q = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      where("orderType", "==", "delivery")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Order);
      });
      // Sort orders by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.error("Orders subscription error:", err);
      setErrorMsg("حدث خطأ أثناء تحميل الطلبات المباشرة.");
      setLoading(false);
    });

    return () => unsub();
  }, [restaurantId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverNameInput.trim()) {
      setErrorMsg("يرجى إدخال اسم السائق.");
      return;
    }
    if (!driverPhoneInput.trim() || driverPhoneInput.length < 10) {
      setErrorMsg("يرجى إدخال رقم هاتف صحيح.");
      return;
    }
    if (!restaurantId) {
      setErrorMsg("يرجى اختيار المطعم المرتبط بالعمل.");
      return;
    }

    const driverData = { name: driverNameInput.trim(), phone: driverPhoneInput.trim() };
    setDriver(driverData);
    localStorage.setItem("islamfood_delivery_driver", JSON.stringify(driverData));
    setErrorMsg("");
  };

  const handleLogoutDriver = () => {
    localStorage.removeItem("islamfood_delivery_driver");
    setDriver(null);
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!driver) return;
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, {
        assignedTo: {
          name: driver.name,
          email: driver.phone, // using phone as identifier
          assignedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error("Error accepting order:", err);
      alert("فشل قبول الطلب. يرجى المحاولة مجدداً.");
    }
  };

  const handleUpdateStatus = async (orderId: string, status: "preparing" | "ready" | "completed" | "cancelled") => {
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, { status });
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("فشل تحديث حالة الطلب.");
    }
  };

  const handleReturnOrder = async (orderId: string) => {
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, {
        assignedTo: null
      });
    } catch (err) {
      console.error("Error unassigning order:", err);
      alert("فشل إرجاع الطلب.");
    }
  };

  // Filter orders based on selected tab
  const availableOrders = orders.filter(o => 
    (o.status === "pending" || o.status === "preparing" || o.status === "ready") && 
    !o.assignedTo
  );

  const myActiveOrders = orders.filter(o => 
    (o.status === "pending" || o.status === "preparing" || o.status === "ready") && 
    o.assignedTo?.name === driver?.name
  );

  const myCompletedOrders = orders.filter(o => 
    o.status === "completed" && 
    o.assignedTo?.name === driver?.name
  );

  // Helper to format currency symbol safely
  const currencySymbol = selectedRes?.currency === 'USD' ? '$' : selectedRes?.currency === 'SAR' ? 'ر.س' : selectedRes?.currency === 'AED' ? 'د.إ' : selectedRes?.currency === 'EUR' ? '€' : 'ج.م';

  // Hidden passcode verification handler
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "2975") {
      setIsPasscodeVerified(true);
      sessionStorage.setItem("islamfood_delivery_verified", "true");
      setPasscodeError("");
    } else {
      setPasscodeError("كلمة المرور السرية غير صحيحة! يرجى التحقق وإعادة المحاولة.");
    }
  };

  if (!isPasscodeVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans select-none" id="delivery-passcode-gate" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 rounded-3xl p-6 border border-orange-500/30 shadow-2xl space-y-6 text-center"
        >
          {/* Logo Brand Header */}
          <div className="space-y-2">
            <div className="w-20 h-20 bg-orange-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-orange-500/20 border-4 border-slate-800">
              <Truck className="w-10 h-10 text-white animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-white tracking-wide">
              بوابة إسلام فود دليفري المغلقة 🔐
            </h1>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">
              هذا التطبيق مخصص ومحمي لكباتن ومندوبي توصيل المنصة. يرجى إدخال رمز التحقق السري المعتمد من الإدارة العامة.
            </p>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            {passcodeError && (
              <div className="bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-bold p-3 rounded-2xl flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{passcodeError}</span>
              </div>
            )}

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-300 block">رمز المرور السري المكون من 4 أرقام *</label>
              <input 
                type="password" 
                maxLength={10}
                placeholder="••••" 
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-orange-500 rounded-2xl p-3.5 text-center text-lg font-mono font-black text-white tracking-widest outline-none transition"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#fa5a00] hover:bg-orange-600 text-white font-black py-3 px-4 rounded-2xl transition duration-150 shadow-lg shadow-orange-500/10 cursor-pointer text-sm"
            >
              تحقق وتخويل الدخول ⚡
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <button 
              onClick={onNavigateHome}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold py-2.5 px-4 rounded-xl transition text-xs cursor-pointer"
            >
              العودة للمنصة الرئيسية 🏠
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Check if delivery services are suspended globally by the platform admin
  if (globalSettings?.deliveryServicesSuspended) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans select-none" id="delivery-suspended">
        <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 border border-red-500/30 shadow-2xl space-y-6 text-center">
          <div className="w-20 h-20 bg-red-950 text-red-500 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-red-950/50 border-4 border-red-900/30">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-red-500 tracking-wide">
              تطبيق الدليفري معطّل حالياً ⚠️
            </h1>
            <p className="text-sm text-slate-300 font-bold leading-relaxed" dir="rtl">
              تم إيقاف تشغيل تطبيق الدليفري وخدمات التوصيل مؤقتاً بقرار من الإدارة العامة لمنصة إسلام فود.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed" dir="rtl">
              يرجى مراجعة إدارة المطعم أو التواصل مع الدعم الفني لمزيد من التفاصيل.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <button 
              onClick={onNavigateHome}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-3 px-4 rounded-xl transition text-xs shadow-md cursor-pointer"
            >
              العودة للمنصة الرئيسية 🏠
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Driver setup / login screen
  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 font-sans select-none" id="delivery-login">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl p-6 border border-slate-700/60 shadow-2xl space-y-6">
          
          {/* Logo Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-orange-650 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-orange-900/30 border-4 border-slate-700 animate-pulse">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              إسلام فود دليفري 🚚
            </h1>
            <p className="text-xs text-orange-200/80 font-bold">
              تطبيق كباتن التوصيل والخدمات السريعة لـ {selectedRes?.name || "إسلام فود"}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-bold p-3 rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Driver Name input */}
            <div className="space-y-1 text-right">
              <label className="text-xs font-bold text-slate-300">اسم الكابتن (ثلاثي) 👤</label>
              <input 
                type="text" 
                placeholder="مثال: يوسف أحمد محمد" 
                value={driverNameInput}
                onChange={(e) => setDriverNameInput(e.target.value)}
                className="w-full bg-slate-750 border border-slate-600/80 focus:border-orange-500 rounded-2xl p-3 text-sm text-white text-right outline-none transition"
                required
              />
            </div>

            {/* Driver Phone input */}
            <div className="space-y-1 text-right">
              <label className="text-xs font-bold text-slate-300">رقم الهاتف النشط للاتصال 📞</label>
              <input 
                type="tel" 
                placeholder="مثال: 01012345678" 
                value={driverPhoneInput}
                onChange={(e) => setDriverPhoneInput(e.target.value)}
                className="w-full bg-slate-750 border border-slate-600/80 focus:border-orange-500 rounded-2xl p-3 text-sm text-white text-right font-mono outline-none transition"
                required
              />
            </div>

            {/* Restaurant Selector */}
            <div className="space-y-1 text-right">
              <label className="text-xs font-bold text-slate-300">اختر الفرع / المطعم المرتبط 🏢</label>
              <select
                value={restaurantId}
                onChange={(e) => {
                  setRestaurantId(e.target.value);
                  const found = restaurantsList.find(r => r.id === e.target.value);
                  if (found) setSelectedRes(found);
                }}
                className="w-full bg-slate-750 border border-slate-600/80 focus:border-orange-500 rounded-2xl p-3 text-sm text-white text-right outline-none transition"
                required
              >
                <option value="">-- يرجى اختيار الفرع --</option>
                {restaurantsList.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.name} ({res.address})
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-550 active:scale-95 text-white font-extrabold py-3.5 px-4 rounded-2xl transition shadow-lg shadow-orange-950/20 text-sm flex items-center justify-center gap-2 mt-2"
            >
              <Check className="w-4 h-4" />
              <span>تسجيل الدخول وبدء استلام الطلبات 🚀</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <button 
              onClick={onNavigateHome}
              className="text-xs text-slate-450 hover:text-slate-300 font-semibold underline"
            >
              العودة للمنصة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="delivery-dashboard">
      
      {/* Top Professional App Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 shadow-lg select-none">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          
          {/* Logo brand & Back to Admin if available */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogoutDriver}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-xl transition border border-slate-750"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
            
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                <p className="text-xs font-black text-white">{driver.name}</p>
              </div>
              <p className="text-[10px] text-slate-450 font-mono font-bold">{driver.phone}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Truck className="w-5 h-5 text-orange-550" />
              <h1 className="text-sm font-black text-white">إسلام فود دليفري</h1>
            </div>
            <p className="text-[9.5px] text-orange-255 font-bold truncate max-w-[160px]">
              {selectedRes?.name || "تحميل الفرع..."}
            </p>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 max-w-4xl w-full mx-auto space-y-4">

        {/* Tab Switcher Panel */}
        <div className="grid grid-cols-3 bg-slate-900 p-1 rounded-2xl border border-slate-800/80 sticky top-[56px] z-30 shadow-md">
          
          <button
            onClick={() => setActiveTab("available")}
            className={`py-2.5 px-1 rounded-xl text-xs font-black transition relative flex flex-col items-center gap-1 ${
              activeTab === "available" 
                ? "bg-orange-650 text-white shadow-md" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1">
              <span>طلبات متاحة</span>
              <span className="bg-slate-950/45 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {availableOrders.length}
              </span>
            </div>
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          </button>

          <button
            onClick={() => setActiveTab("my_active")}
            className={`py-2.5 px-1 rounded-xl text-xs font-black transition relative flex flex-col items-center gap-1 ${
              activeTab === "my_active" 
                ? "bg-orange-650 text-white shadow-md" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1">
              <span>طلباتي النشطة</span>
              <span className="bg-slate-950/45 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {myActiveOrders.length}
              </span>
            </div>
            <Truck className="w-3.5 h-3.5 shrink-0" />
          </button>

          <button
            onClick={() => setActiveTab("my_completed")}
            className={`py-2.5 px-1 rounded-xl text-xs font-black transition relative flex flex-col items-center gap-1 ${
              activeTab === "my_completed" 
                ? "bg-orange-650 text-white shadow-md" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-1">
              <span>مكتملة</span>
              <span className="bg-slate-950/45 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {myCompletedOrders.length}
              </span>
            </div>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          </button>

        </div>

        {/* Selected View List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-orange-550 mx-auto animate-spin" />
              <p className="text-xs text-slate-450 font-bold">جاري المزامنة المباشرة لقاعدة بيانات الدليفري...</p>
            </div>
          ) : (
            <>
              {activeTab === "available" && (
                <div className="space-y-3">
                  {availableOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-8 text-center space-y-2">
                      <ShoppingBag className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">لا يوجد طلبات دليفري معلقة بانتظار سائق حالياً.</p>
                      <p className="text-[10px] text-slate-500">سيتم تحديث هذه القائمة فوراً عند إرسال الكاشير طلبات جديدة.</p>
                    </div>
                  ) : (
                    availableOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        currencySymbol={currencySymbol}
                        onAccept={() => handleAcceptOrder(order.id)}
                        type="available"
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "my_active" && (
                <div className="space-y-3">
                  {myActiveOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-8 text-center space-y-2">
                      <Truck className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">ليس لديك أي أوردر نشط قيد التوصيل حالياً.</p>
                      <p className="text-[10px] text-slate-500">اذهب لعلامة "طلب معلق" واقبل أوردرات لتبدأ رحلتك!</p>
                    </div>
                  ) : (
                    myActiveOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        currencySymbol={currencySymbol}
                        type="my_active"
                        onUpdateStatus={(status) => handleUpdateStatus(order.id, status)}
                        onReturn={() => handleReturnOrder(order.id)}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "my_completed" && (
                <div className="space-y-3">
                  {myCompletedOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-8 text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">لم تقم بتوصيل أي طلبات اليوم بعد.</p>
                      <p className="text-[10px] text-slate-500">تمسك بهمتك العالية وحقق أرقام مبيعات ممتازة!</p>
                    </div>
                  ) : (
                    myCompletedOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        currencySymbol={currencySymbol}
                        type="my_completed"
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Tiny Footer */}
      <footer className="bg-slate-900 py-3 border-t border-slate-850 text-center select-none">
        <p className="text-[9.5px] text-slate-500 font-bold">
          نظام كابتن إسلام فود دليفري • مدمج بالكامل مع نظام الإدارة الموحد
        </p>
      </footer>
    </div>
  );
}

// Order Card Component
interface OrderCardProps {
  key?: any;
  order: Order;
  currencySymbol: string;
  type: "available" | "my_active" | "my_completed";
  onAccept?: () => void;
  onUpdateStatus?: (status: "preparing" | "ready" | "completed" | "cancelled") => void;
  onReturn?: () => void;
}

function OrderCard({ order, currencySymbol, type, onAccept, onUpdateStatus, onReturn }: OrderCardProps) {
  const [showItems, setShowItems] = useState(false);

  const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const isOverdue = elapsedMinutes > 45;

  const paymentMethodLabel = order.paymentMethod === 'visa' ? 'فيزا كارد' :
                             order.paymentMethod === 'instapay' ? 'تطبيق إنستا باي' :
                             order.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : 'كاش عند الاستلام';

  return (
    <div className={`bg-slate-900 rounded-3xl border p-4 transition duration-150 flex flex-col gap-3.5 shadow-md ${
      isOverdue && (order.status !== "completed" && order.status !== "cancelled")
        ? "border-red-650/80 ring-2 ring-red-500/10"
        : "border-slate-800"
    }`}>
      
      {/* Header Row */}
      <div className="flex justify-between items-start gap-3">
        
        {/* Status badges */}
        <div className="text-left">
          <p className="text-xs font-black text-orange-550 leading-none">
            {order.totalPrice} {currencySymbol}
          </p>
          <span className="text-[9px] text-slate-400 font-bold block mt-1">
            {paymentMethodLabel}
          </span>
        </div>

        {/* Title, order ID */}
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            {isOverdue && (order.status !== "completed" && order.status !== "cancelled") && (
              <span className="bg-red-950/60 text-red-400 border border-red-500/30 text-[8.5px] px-1.5 py-0.5 rounded font-black animate-pulse">
                متأخر جداً! ⚠️
              </span>
            )}
            <h4 className="font-black text-xs text-white">
              {order.dailyOrderNumber ? `طلب ${order.dailyOrderNumber}` : `طلب #${order.id.slice(-6).toUpperCase()}`}
            </h4>
          </div>
          
          <p className="text-[9.5px] text-slate-450 font-bold mt-1">
            منذ {elapsedMinutes} دقيقة • {new Date(order.createdAt).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

      </div>

      {/* Customer Contact & Address Info Box */}
      <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/60 space-y-2 text-right">
        
        <div className="flex justify-between items-center flex-wrap gap-2">
          {/* Phone Link Call action */}
          <a 
            href={`tel:${order.customerPhone}`}
            className="flex items-center gap-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-500/30 font-bold text-[10.5px] py-1 px-2.5 rounded-lg transition"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>اتصال بالعميل 📞</span>
          </a>

          <p className="text-xs font-black text-slate-250">
            أستاذ / {order.customerName}
          </p>
        </div>

        <div className="border-t border-slate-800/40 pt-2 space-y-1.5">
          <div className="flex items-start justify-end gap-1.5">
            <span className="text-xs text-slate-350 font-semibold leading-relaxed">
              {order.customerStreet || order.deliveryAddress || "لا يوجد تفاصيل للشارع"}
            </span>
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          </div>

          <div className="flex justify-between items-center">
            {/* Maps Directions */}
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order.customerGovernorate || "") + " " + (order.customerStreet || "") + " " + (order.deliveryAddress || ""))}`}
              target="_blank"
              rel="noreferrer"
              className="text-[9.5px] text-sky-400 font-bold hover:underline flex items-center gap-1"
            >
              <Navigation className="w-3 h-3 text-sky-400 shrink-0" />
              <span>الاتجاهات على الخريطة 🗺️</span>
            </a>

            <p className="text-[10px] text-slate-400 font-bold">
              المنطقة: {order.customerGovernorate || "وسط البلد"}
            </p>
          </div>
        </div>

      </div>

      {/* Live Interactive Delivery Map */}
      {type === "my_active" && (
        <div className="my-1">
          <LiveDeliveryMap order={order} role="driver" />
        </div>
      )}

      {/* Expandable Menu Items list */}
      <div className="border-t border-slate-850 pt-2 text-right">
        <button 
          onClick={() => setShowItems(!showItems)}
          className="text-[10px] font-black text-orange-450 hover:text-orange-550 flex items-center gap-1 mr-auto"
        >
          <span>{showItems ? "إخفاء التفاصيل" : "عرض أصناف الأوردر 🍕"}</span>
        </button>

        {showItems && (
          <div className="bg-slate-950/45 p-2.5 rounded-xl border border-slate-800 mt-2 space-y-1.5">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between text-xs text-slate-300 font-bold">
                <span>{item.price * item.quantity} {currencySymbol}</span>
                <span>{item.name} × {item.quantity}</span>
              </div>
            ))}
            {order.deliveryFee ? (
              <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/50 pt-1.5 font-bold">
                <span>{order.deliveryFee} {currencySymbol}</span>
                <span>خدمة التوصيل</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Action Buttons specific to driver dashboard tabs */}
      <div className="flex items-center gap-2 mt-1 select-none">
        
        {type === "available" && onAccept && (
          <button
            onClick={onAccept}
            className="w-full bg-orange-650 hover:bg-orange-600 active:scale-97 text-white font-black py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>قبول وتوصيل الطلب الآن 🏍️</span>
          </button>
        )}

        {type === "my_active" && onUpdateStatus && onReturn && (
          <div className="w-full flex flex-col sm:flex-row gap-2">
            
            {order.status === "pending" || order.status === "preparing" ? (
              <button
                onClick={() => onUpdateStatus("ready")}
                className="flex-1 bg-amber-600 hover:bg-amber-550 active:scale-97 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>تحويل لـ "جاهز للتسليم" 🍳</span>
              </button>
            ) : (
              <button
                onClick={() => onUpdateStatus("completed")}
                className="flex-1 bg-emerald-650 hover:bg-emerald-600 active:scale-97 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>تم التوصيل بنجاح ✅</span>
              </button>
            )}

            <button
              onClick={onReturn}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition"
              title="إرجاع الطلب للوحة السائقين"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>إلغاء قبولي ↩️</span>
            </button>

          </div>
        )}

        {type === "my_completed" && (
          <div className="w-full bg-slate-950/30 py-2 px-3 rounded-xl text-center border border-emerald-500/15 text-[10px] font-black text-emerald-400 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>تم التوصيل بنجاح وتم تسليم المبلغ 💵</span>
          </div>
        )}

      </div>

    </div>
  );
}
