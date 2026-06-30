import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  collection, query, orderBy, limit, onSnapshot, getDocs, doc 
} from "firebase/firestore";
import { 
  Activity, Eye, Users, ShoppingBag, CheckCircle, Clock, 
  ShieldAlert, Sparkles, Monitor, Smartphone, Globe, RefreshCw 
} from "lucide-react";
import { Order } from "../types";

interface ActivityLog {
  id: string;
  type: string;
  userRole: "customer" | "owner" | "staff_callcenter";
  description: string;
  orderId?: string;
  userAgent?: string;
  timestamp: string;
}

interface OnlineClient {
  id: string;
  role: "customer" | "owner" | "agent";
  lastActive: number;
  updatedAt: string;
}

interface ActivityLogViewProps {
  restaurantId: string;
  orders: Order[];
}

export default function ActivityLogView({ restaurantId, orders }: ActivityLogViewProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [onlineClients, setOnlineClients] = useState<OnlineClient[]>([]);
  const [registeredLoyaltyCount, setRegisteredLoyaltyCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [totalVisits, setTotalVisits] = useState(0);
  const [customerVisits, setCustomerVisits] = useState(0);
  const [ownerVisits, setOwnerVisits] = useState(0);

  // Fetch registered loyalty users once
  const fetchLoyaltyCount = async () => {
    try {
      const loyaltyRef = collection(db, "restaurants", restaurantId, "loyalty_users");
      const snap = await getDocs(loyaltyRef);
      setRegisteredLoyaltyCount(snap.size);
    } catch (err) {
      console.error("Error fetching loyalty users count:", err);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;

    setLoading(true);
    fetchLoyaltyCount();

    // 1. Subscribe to latest 50 activity logs
    const logsRef = collection(db, "restaurants", restaurantId, "activity_logs");
    const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(50));
    
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const fetchedLogs: ActivityLog[] = [];
      let visitsCount = 0;
      let custVisits = 0;
      let ownVisits = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Omit<ActivityLog, "id">;
        fetchedLogs.push({ id: doc.id, ...data });
      });

      setLogs(fetchedLogs);
      
      // Look up inside all database logs to tally visits if we want a quick reactive count, 
      // or we can run a count on all logs. Since they might be more than 50, let's tally from snapshot initially or count all logs:
      const countVisits = async () => {
        try {
          const allLogsSnap = await getDocs(query(logsRef));
          let totalV = 0, custV = 0, ownV = 0;
          allLogsSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.type === "visit") {
              totalV++;
              if (data.userRole === "customer") custV++;
              else if (data.userRole === "owner") ownV++;
            }
          });
          setTotalVisits(totalV);
          setCustomerVisits(custV);
          setOwnerVisits(ownV);
        } catch (e) {
          console.error(e);
        }
      };
      countVisits();
      setLoading(false);
    }, (err) => {
      console.error("Logs subscribe error:", err);
      setLoading(false);
    });

    // 2. Subscribe to online client presence
    const onlineRef = collection(db, "restaurants", restaurantId, "online_clients");
    const unsubOnline = onSnapshot(onlineRef, (snapshot) => {
      const clients: OnlineClient[] = [];
      const now = Date.now();
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as OnlineClient;
        // Filter out stale heartbeats older than 45 seconds
        if (data.lastActive && now - data.lastActive < 45000) {
          clients.push(data);
        }
      });
      setOnlineClients(clients);
    });

    return () => {
      unsubLogs();
      unsubOnline();
    };
  }, [restaurantId]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchLoyaltyCount();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Compute live properties
  const activeOrdersCount = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing" || o.status === "ready"
  ).length;

  const onlineCustomers = onlineClients.filter(c => c.role === "customer").length;
  const onlineOwners = onlineClients.filter(c => c.role === "owner" || c.role === "agent").length;

  // Helper to parse dates
  const formatTimeAgo = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "الآن";
      if (diffMins === 1) return "منذ دقيقة";
      if (diffMins === 2) return "منذ دقيقتين";
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours === 1) return "منذ ساعة";
      if (diffHours === 2) return "منذ ساعتين";
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      
      return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " - " + date.toLocaleDateString("ar-EG");
    } catch {
      return isoString;
    }
  };

  // Helper for device type mapping
  const detectDeviceType = (ua?: string) => {
    if (!ua) return <Globe className="w-4 h-4 text-slate-400" />;
    const lower = ua.toLowerCase();
    if (lower.includes("mobi") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone className="w-4 h-4 text-amber-500" title="هاتف محمول" />;
    }
    return <Monitor className="w-4 h-4 text-blue-500" title="كمبيوتر مكتبي" />;
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-6 rounded-3xl border border-orange-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600 block shrink-0 animate-pulse" />
            منظومة المراقبة الذكية وسجل حركات النظام 📜
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مراقبة حية لزيارات الرابط بنوعيها، المتصلين الفعليين بالمنصة حالياً، الطلبات النشطة، والعملاء المسجلين.
          </p>
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex bg-white hover:bg-slate-50 disabled:opacity-50 py-2 px-4 rounded-full border border-slate-200 text-xs font-bold text-slate-700 items-center justify-center gap-2 cursor-pointer self-start md:self-center active:scale-95 transition"
        >
          <RefreshCw className={`w-4 h-4 text-orange-500 ${refreshing ? "animate-spin" : ""}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Grid Cards Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Link Visits */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-500" />
          <div>
            <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider mb-1">زيارات الرابط</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight">{totalVisits}</span>
              <span className="text-xs text-slate-500 font-bold">زيارة إجمالية</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-2">
              <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold">العملاء: {customerVisits}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">المالك: {ownerVisits}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition shrink-0">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Connected Clients */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
          <div>
            <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider mb-1">المتصلون الآن بالمنصة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                <span className="flex h-3 w-3 relative justify-center items-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                {onlineClients.length}
              </span>
              <span className="text-xs text-slate-500 font-bold">نشط حالياً</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-2">
              <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">العملاء: {onlineCustomers}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">المالك/الطاقم: {onlineOwners}</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition shrink-0">
            <Users className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Card 3: Active Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
          <div>
            <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider mb-1">كم طلب حالي / دائر</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight">{activeOrdersCount}</span>
              <span className="text-xs text-slate-500 font-bold">طلب نشط</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              تصفية حية من المطبخ للتوصيل والصالة الفورية
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Registered Individuals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-violet-500" />
          <div>
            <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider mb-1">الأفراد والعملاء المسجلين</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight">{registeredLoyaltyCount}</span>
              <span className="text-xs text-slate-500 font-bold">عضو مسجل بالولاء</span>
            </div>
            <p className="text-[10px] text-slate-550 mt-2">
              العملاء المسجلين لمطعمك بنظام تجميع النقاط
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 group-hover:scale-110 transition shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Boards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right side: Realtime activity feed (takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-orange-600 animate-pulse" />
              البث المباشر لأحداث وعمليات المنصة 📡
            </h3>
            <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
              آخر {logs.length} حركات
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 font-bold animate-pulse">
              جاري موازنة وتأمين اتصال الاتجاه الثنائي مع النظام الفرعي...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 leading-relaxed">
              لا توجد حركات مسجلة حالياً لموقعك.<br />بمجرد دخول العملاء وقبول طلباتهم، تظهر الأنشطة فوراً هنا!
            </div>
          ) : (
            <div className="flow-root max-h-[480px] overflow-y-auto pr-1">
              <ul className="-mb-8">
                {logs.map((log, idx) => {
                  // Determine icon and color based on log type
                  let iconBg = "bg-slate-100 text-slate-600";
                  let IconComponent = Eye;
                  
                  if (log.type === "order_created") {
                    iconBg = "bg-orange-500 text-white shadow-md shadow-orange-500/20";
                    IconComponent = ShoppingBag;
                  } else if (log.type === "order_status_changed") {
                    iconBg = "bg-blue-600 text-white shadow-md shadow-blue-600/10";
                    IconComponent = CheckCircle;
                  } else if (log.type === "visit") {
                    if (log.userRole === "owner") {
                      iconBg = "bg-slate-800 text-amber-400 border border-slate-700";
                      IconComponent = Monitor;
                    } else {
                      iconBg = "bg-orange-50 text-orange-600";
                      IconComponent = Eye;
                    }
                  } else if (log.type === "loyalty_check") {
                    iconBg = "bg-violet-100 text-violet-700";
                    IconComponent = Sparkles;
                  }

                  return (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {idx !== logs.length - 1 && (
                          <span
                            className="absolute top-4 right-5 -mr-px h-full w-0.5 bg-slate-100"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3 space-x-reverse">
                          <div>
                            <span className={`h-10 w-10 rounded-xl flex items-center justify-center ring-8 ring-white shrink-0 ${iconBg}`}>
                              <IconComponent className="w-5 h-5" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-700 font-extrabold max-w-md leading-relaxed">
                                {log.description}
                              </p>
                              {log.userAgent && (
                                <span className="text-[10px] text-slate-400 mt-1 block font-mono flex items-center gap-1">
                                  {detectDeviceType(log.userAgent)}
                                  معالج التصفح: {log.userAgent.substring(0, 60)}...
                                </span>
                              )}
                            </div>
                            <div className="text-left whitespace-nowrap shrink-0">
                              <span className="text-[10.5px] font-mono text-slate-400 flex items-center gap-1 justify-end">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTimeAgo(log.timestamp)}
                              </span>
                              <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded mt-1 inline-block ${
                                log.userRole === "owner" 
                                  ? "bg-slate-900 text-white" 
                                  : "bg-orange-100 text-orange-850"
                              }`}>
                                {log.userRole === "owner" ? "مالك المؤسسة" : "عميل"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Left side: Live connected status (takes 1 col) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              المتصلون الآن 🟢
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              قائمة تفاعلية فورية بجميع المالكين والعملاء النشطين حالياً.
            </p>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto">
            {onlineClients.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا يعطي أي جهاز متصل نبضات حالياً.
              </div>
            ) : (
              onlineClients.map((client) => (
                <div 
                  key={client.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      client.role === "owner" 
                        ? "bg-slate-900 text-white" 
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {client.role === "owner" ? "👑" : "👤"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">
                          {client.role === "owner" ? "المالك (نشط)" : "عميل جديد بالمنيو"}
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <span className="text-[9.5px] text-slate-450 block font-mono">
                        رقم العقد: {client.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-left font-mono text-[9px] text-slate-400">
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      متصل الآن
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
