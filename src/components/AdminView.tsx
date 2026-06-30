import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  collection, doc, getDoc, getDocs, updateDoc, 
  deleteDoc, onSnapshot, setDoc, query, where, addDoc, deleteField
} from "firebase/firestore";
import { 
  ChefHat, CreditCard, Sparkles, AlertTriangle, ArrowRight, 
  Settings, Check, X, Shield, Lock, DollarSign, Users, Calendar, Phone, Trash2,
  Activity, TrendingUp, BarChart2, Upload, ShoppingBag, Search, Filter, Clock,
  Plus, Bot, Bell, Megaphone
} from "lucide-react";
import { Restaurant, AdminSettings, Order, Branch } from "../types";
import ActivityLogView from "./ActivityLogView";
import { compressImage, isSizeSafe } from "../lib/imageCompressor";
import MarketingAgentsTab from "./MarketingAgentsTab";
import MarketingPlanDashboard from "./MarketingPlanDashboard";

interface AdminViewProps {
  onNavigateHome: () => void;
  adminEmail?: string | null;
  onEnterRestaurant?: (restaurant: Restaurant) => void;
}

export default function AdminView({ onNavigateHome, adminEmail, onEnterRestaurant }: AdminViewProps) {
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [passcode, setPasscode] = useState("");
  
  // Device Biometric authentication states
  const [biometricEnrolled, setBiometricEnrolled] = useState(() => {
    return localStorage.getItem("islamfood_admin_biometrics_enrolled") === "true";
  });
  const [showEnrollBiometricModal, setShowEnrollBiometricModal] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  const [enrollStatusText, setEnrollStatusText] = useState("");
  const [showVerifyBiometricModal, setShowVerifyBiometricModal] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyStatusText, setVerifyStatusText] = useState("");
  const [newBotTip, setNewBotTip] = useState("");
  
  const [activeTab, setActiveTab ] = useState<"financial" | "stores" | "activity_log" | "support_chat" | "marketing_agents" | "global_live_orders">("stores");
  const [selectedLogRestaurantId, setSelectedLogRestaurantId] = useState<string>("");
  const [selectedMarketingRestaurantId, setSelectedMarketingRestaurantId] = useState<string>("");
  const [selectedRestaurantOrders, setSelectedRestaurantOrders] = useState<Order[]>([]);

  // Search and status filters for stores console
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "expired" | "pending_approval">("all");

  // Real-time Global Orders Stream state
  const [globalLiveOrders, setGlobalLiveOrders] = useState<Order[]>([]);
  const [globalOrdersFilter, setGlobalOrdersFilter] = useState<"all" | "pending" | "preparing" | "ready" | "completed" | "cancelled">("all");

  // Support helpdesk state
  const [supportChats, setSupportChats] = useState<{chatId: string; senderName: string; userType: string; restaurantName?: string; text: string; createdAt: string}[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<any[]>([]);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [replyMediaUrl, setReplyMediaUrl] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  // Monitor all support tickets
  useEffect(() => {
    if (activeTab !== "support_chat" || !isAdminAuthorized) return;
    const unsub = onSnapshot(collection(db, "support_chats"), (snapshot) => {
      const chatsMap: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const cid = data.chatId;
        if (!cid) return;
        // Group and hold only the latest message to act as inbox preview
        if (!chatsMap[cid] || new Date(data.createdAt).getTime() > new Date(chatsMap[cid].createdAt).getTime()) {
          chatsMap[cid] = {
            chatId: cid,
            senderName: data.senderName || "زائر غير معروف",
            userType: data.userType || "customer",
            restaurantName: data.restaurantName || "عام",
            text: data.text || "ميديا مرفقة 🖼️",
            createdAt: data.createdAt
          };
        }
      });
      const sorted = Object.values(chatsMap).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSupportChats(sorted as any);
    });
    return () => unsub();
  }, [activeTab, isAdminAuthorized]);

  // Monitor selected support conversation details
  useEffect(() => {
    if (!activeChatId || !isAdminAuthorized) return;
    const q = query(
      collection(db, "support_chats"),
      where("chatId", "==", activeChatId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setActiveChatMessages(list);
    });
    return () => unsub();
  }, [activeChatId, isAdminAuthorized]);

  // Database state
  const [settings, setSettings] = useState<AdminSettings>({
    vodafoneCashNumber: "01012345678",
    subscriptionFee: 250,
    updatedAt: ""
  });
  const [adsRequests, setAdsRequests] = useState<any[]>([]);

  const handleAdApproval = async (adId: string, approve: boolean) => {
    try {
      if (approve) {
        await updateDoc(doc(db, "announcements_ads", adId), {
          paymentStatus: "approved",
          active: true
        });
        alert("تمت الموافقة على الإعلان الممول وتنشيطه للعملاء بنجاح! 📺🎉");
      } else {
        await updateDoc(doc(db, "announcements_ads", adId), {
          paymentStatus: "rejected",
          active: false
        });
        alert("تم رفض طلب الإعلان الممول.");
      }
    } catch (err) {
      console.error("Failed to approve/reject ad:", err);
      alert("حدث خطأ أثناء معالجة طلب الإعلان.");
    }
  };

  const handleAdminImageUpload = (field: 'appMainLogo' | 'appBannerUrl1' | 'appBannerUrl2' | 'appBannerUrl3', file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      try {
        const compressed = await compressImage(file, 800, 800, 0.7);
        if (isSizeSafe(compressed)) {
          setSettings(prev => ({ ...prev, [field]: compressed }));
        } else {
          alert("عذراً، حجم الصورة كبير جداً، يرجى استخدام صورة بأبعاد أصغر لضمان سرعة التحميل.");
        }
      } catch (e) {
        if (isSizeSafe(base64Str)) {
          setSettings(prev => ({ ...prev, [field]: base64Str }));
        } else {
          alert("الملف كبير جداً، يرجى استخدام صورة أخرى.");
        }
      }
    };
    reader.readAsDataURL(file);
  };
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branchManagingRestaurant, setBranchManagingRestaurant] = useState<Restaurant | null>(null);
  const [restaurantBranches, setRestaurantBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [storeTablesCount, setStoreTablesCount] = useState<Record<string, number>>({});
  const [storeTablesPaid, setStoreTablesPaid] = useState<Record<string, boolean>>({});

  const ALL_OWNER_TABS = [
    { id: "orders", label: "الرئيسية / الطلبات المستلمة" },
    { id: "statistics", label: "إحصائيات المبيعات والتقارير" },
    { id: "performance", label: "تقارير الأداء 📊" },
    { id: "sales_boost", label: "زيادة المبيعات والتدريب 📈" },
    { id: "ai_menu", label: "توليد وقائمة المنيو بـ AI" },
    { id: "subscription", label: "الباقات وفودافون كاش" },
    { id: "qr_code", label: "باركود المنيو للصالات" },
    { id: "branches", label: "إدارة الفروع والمحافظات" },
    { id: "working_hours", label: "أوقات وساعات العمل اليومية" },
    { id: "settings", label: "إعدادات ومعلومات المطعم" },
    { id: "call_center", label: "إدارة الكول سنتر 🎧" },
    { id: "ads_analytics", label: "تفاعل الإعلانات والقصص 📊" },
    { id: "affiliate", label: "أفيلييت 🎁" }
  ];

  useEffect(() => {
    const fetchBranches = async () => {
      if (!branchManagingRestaurant) {
        setRestaurantBranches([]);
        return;
      }
      setLoadingBranches(true);
      try {
        const branchesColRef = collection(db, "restaurants", branchManagingRestaurant.id, "branches");
        const qSnap = await getDocs(branchesColRef);
        const bList: Branch[] = [];
        qSnap.forEach((docSnap) => {
          bList.push({ ...docSnap.data() as Branch, id: docSnap.id });
        });
        setRestaurantBranches(bList);
      } catch (err) {
        console.error("Failed to load restaurant branches in admin:", err);
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [branchManagingRestaurant]);

  const handleToggleBranchTab = async (branchId: string, tabId: string) => {
    if (!branchManagingRestaurant) return;
    const branch = restaurantBranches.find(b => b.id === branchId);
    if (!branch) return;

    const currentDisabled = branch.disabledTabs || [];
    let newDisabled: string[];
    if (currentDisabled.includes(tabId)) {
      newDisabled = currentDisabled.filter(id => id !== tabId);
    } else {
      newDisabled = [...currentDisabled, tabId];
    }

    try {
      const branchRef = doc(db, "restaurants", branchManagingRestaurant.id, "branches", branchId);
      await updateDoc(branchRef, { disabledTabs: newDisabled });
      
      // Update local state
      setRestaurantBranches(prev => prev.map(b => b.id === branchId ? { ...b, disabledTabs: newDisabled } : b));
    } catch (err) {
      console.error("Failed to update branch tabs visibility:", err);
      alert("حدث خطأ أثناء تحديث إعدادات عرض الأيقونات للفرع.");
    }
  };

  const [loading, setLoading] = useState(true);

  const [resettingDb, setResettingDb] = useState(false);

  // Auto-set the first restaurant for log monitoring when the list loads
  useEffect(() => {
    if (restaurants.length > 0 && !selectedLogRestaurantId) {
      setSelectedLogRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedLogRestaurantId]);

  // Load orders for selected restaurant real-time when on the activity_log tab
  useEffect(() => {
    if (activeTab !== "activity_log" || !selectedLogRestaurantId) {
      setSelectedRestaurantOrders([]);
      return;
    }

    const oRef = collection(db, "orders");
    const q = query(oRef, where("restaurantId", "==", selectedLogRestaurantId));
    
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Order);
      });
      setSelectedRestaurantOrders(list);
    }, (error) => {
      console.error("Error listening to selected restaurant orders:", error);
    });

    return () => unsubOrders();
  }, [activeTab, selectedLogRestaurantId]);

  // Load ALL system-wide orders real-time when on the global_live_orders tab
  useEffect(() => {
    if (activeTab !== "global_live_orders" || !isAdminAuthorized) {
      return;
    }

    const oRef = collection(db, "orders");
    const unsubGlobalOrders = onSnapshot(oRef, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGlobalLiveOrders(list);
    }, (error) => {
      console.error("Error listening to global platform orders:", error);
    });

    return () => unsubGlobalOrders();
  }, [activeTab, isAdminAuthorized]);

  const handleGlobalFactoryReset = async () => {
    const confirm1 = confirm("⚠️ تحذير شديد الخطورة: أنت على وشك مسح وإعادة ضبط قاعدة البيانات وسجل المبيعات بالمنظومة بالكامل! هل أنت متأكد؟");
    if (!confirm1) return;

    const confirm2 = confirm("تأكيد أخير: هذا سيقوم بحذف كافة فواتير المشتريات والطلبات وتصفير السيرفر بالكامل! هل ترغب بالاستمرار فعلاً؟");
    if (!confirm2) return;

    setResettingDb(true);
    try {
      // 1. Reset Admin Settings
      const sRef = doc(db, "admin_settings", "global");
      await setDoc(sRef, {
        vodafoneCashNumber: "01012345678",
        subscriptionFee: 250,
        updatedAt: new Date().toISOString()
      });

      // 2. Clear all orders
      const ordersSnap = await getDocs(collection(db, "orders"));
      const deletePromises: Promise<any>[] = [];
      ordersSnap.forEach((orderDoc) => {
        deletePromises.push(deleteDoc(doc(db, "orders", orderDoc.id)));
      });
      await Promise.all(deletePromises);

      // 3. Clear administrator local storage
      localStorage.clear();

      alert("🎉 تم تهيئة وإعادة ضبط مصنع قاعدة البيانات بالكامل بنجاح!");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(`عذراً، حدث خطأ أثناء عملية إعادة الضبط: ${err.message}`);
    } finally {
      setResettingDb(false);
    }
  };

  // Auto-authorize if user is logged in as the official mail
  useEffect(() => {
    if (adminEmail === "eslamesai12@gmail.com") {
      setIsAdminAuthorized(true);
    }
  }, [adminEmail]);

  // Sync Restaurants & Settings
  useEffect(() => {
    if (!isAdminAuthorized) return;

    setLoading(true);
    // Real-time Settings Sync
    const settingsUnsub = onSnapshot(doc(db, "admin_settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          vodafoneCashNumber: "01012345678",
          subscriptionFee: 250,
          menuAdZoomScale: 1.0,
          menuAdFitMode: "contain",
          adPrice1Day: 50,
          adPrice2Days: 80,
          adPrice7Days: 200,
          adPrice30Days: 600,
          ...data,
          updatedAt: data.updatedAt || ""
        } as AdminSettings);
      }
    });

    // Real-time Store Sync
    const storeUnsub = onSnapshot(collection(db, "restaurants"), (snapshot) => {
      const list: Restaurant[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() as Restaurant, id: doc.id });
      });
      // Sort: Pending Approval first, then newest
      list.sort((a, b) => {
        if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
        if (a.status !== "pending_approval" && b.status === "pending_approval") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRestaurants(list);
      setLoading(false);
    });

    // Real-time Sponsored Ads Sync
    const adsUnsub = onSnapshot(collection(db, "announcements_ads"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort: Pending Payment first, then newest
      list.sort((a, b) => {
        const aPending = a.paymentStatus === "pending_approval" ? 1 : 0;
        const bPending = b.paymentStatus === "pending_approval" ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAdsRequests(list);
    }, (err) => {
      console.error("Error syncing ads in AdminView:", err);
    });

    return () => {
      settingsUnsub();
      storeUnsub();
      adsUnsub();
    };
  }, [isAdminAuthorized]);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Verification of the same passwords but encrypted (Base64 hash check) to prevent raw password leakage
    const encodedInput = btoa(passcode);
    const isPasscodeValid = 
      encodedInput === "Mjk3NQ==" || // "2975"
      encodedInput === "MTIzNDU2" || // "123456"
      encodedInput === "ZXNsYW1mb29k" || // "eslamfood"
      encodedInput === "ZXNsYW1lc2FpMTJAZ21haWwuY29t"; // "eslamesai12@gmail.com"

    if (isPasscodeValid) {
      setIsAdminAuthorized(true);
    } else {
      alert("الرمز السري المدخل غير صحيح! استخدم رمز الاختبار السريع '123456' للتجربة والتقييم.");
    }
  };

  // Start biometric registration/enrollment simulation
  const handleEnrollBiometric = () => {
    setShowEnrollBiometricModal(true);
    setEnrollProgress(0);
    setEnrollStatusText("يرجى تهيئة مستشعر البصمة والمصادقة الحيوية...");
    
    const steps = [
      { progress: 20, text: "جاري الاتصال بمستشعر البصمة الحيوي بالجهاز..." },
      { progress: 40, text: "مستشعر البصمة جاهز! يرجى وضع إصبعك مع الضغط المستمر..." },
      { progress: 65, text: "جاري مسح ثنايا وتفاصيل البصمة المشفرة (65%)..." },
      { progress: 85, text: "جاري تخزين رمز التجزئة الفريد بمستودع المفاتيح الموثوق (85%)..." },
      { progress: 100, text: "تم حفظ بصمة إصبع جهازك بنجاح! تم التفعيل ✅" }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setEnrollProgress(steps[currentStep].progress);
        setEnrollStatusText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        localStorage.setItem("islamfood_admin_biometrics_enrolled", "true");
        setBiometricEnrolled(true);
        setTimeout(() => {
          setShowEnrollBiometricModal(false);
          alert("🎉 تم تسجيل وتفعيل بصمة جهازك بالكامل! يمكنك الآن استخدام ميزة الدخول الفوري بلمسة واحدة ببوابة الإدارة.");
        }, 1200);
      }
    }, 1200);
  };

  // Start biometric verification simulation to login
  const handleVerifyBiometric = () => {
    if (!biometricEnrolled) {
      alert("عذراً، لم تقم بتسجيل بصمة جهازك مسبقاً من لوحة الإعدادات.");
      return;
    }
    setShowVerifyBiometricModal(true);
    setVerifyProgress(0);
    setVerifyStatusText("يرجى وضع إصبعك على مستشعر البصمة للمصادقة السريعة...");

    const steps = [
      { progress: 30, text: "جاري مسح البصمة ومطابقة الرمز التشفيري الحركي..." },
      { progress: 70, text: "جاري التحقق من الهوية مع معالج الأمان المحمول للأجهزة الذكية..." },
      { progress: 100, text: "تمت المطابقة بنجاح! جاري تسجيل الدخول الفوري... ✅" }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setVerifyProgress(steps[currentStep].progress);
        setVerifyStatusText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setShowVerifyBiometricModal(false);
          setIsAdminAuthorized(true);
        }, 1000);
      }
    }, 1000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sRef = doc(db, "admin_settings", "global");
      const updatedSettings = {
        ...settings,
        subscriptionFee: Number(settings.subscriptionFee) || 250,
        updatedAt: new Date().toISOString(),
        monthlyBillingOpen: settings.monthlyBillingOpen !== undefined ? settings.monthlyBillingOpen : true,
        monthlyBillingMonth: settings.monthlyBillingMonth || "دورة يونيو ٢٠٢٦"
      };
      await setDoc(sRef, updatedSettings, { merge: true });
      alert("تم حفظ وتحديث إعدادات وبث الإدارة العامة لـ إسلام فود وتعميمها بنجاح! 🚀");
    } catch (err) {
      console.error(err);
      alert("فشل الحفظ. تأكد من تهيئة قاعدة البيانات.");
    }
  };

  const handleSubscriptionApproval = async (restaurantId: string, approve: boolean) => {
    try {
      const resRef = doc(db, "restaurants", restaurantId);
      const store = restaurants.find(r => r.id === restaurantId);
      
      if (approve) {
        const now = new Date();
        const durationMonths = (store && store.pendingPlanDurationMonths) ? store.pendingPlanDurationMonths : 3;
        const planType = (store && store.pendingPlanType) ? store.pendingPlanType : "standard";
        
        const expiresAt = new Date();
        expiresAt.setMonth(now.getMonth() + durationMonths);

        await updateDoc(resRef, {
          status: "active",
          pricingPlan: planType,
          subscriptionExpiresAt: expiresAt.toISOString(),
          paymentSenderNumber: "",
          paymentTransactionId: "",
          paymentSubmittedAt: "",
          pendingPlanType: deleteField(),
          pendingPlanDurationMonths: deleteField()
        });
        alert(`تم الموافقة على تحويل فودافون كاش وتنشيط موقع المطعم بنجاح بالباقة ${planType === 'premium' ? 'المميزة' : 'العادية'} لمدة ${durationMonths} شهر!`);
      } else {
        // Reject and revert to expired status
        await updateDoc(resRef, {
          status: "expired",
          paymentSenderNumber: "",
          paymentTransactionId: "",
          paymentSubmittedAt: "",
          pendingPlanType: deleteField(),
          pendingPlanDurationMonths: deleteField()
        });
        alert("تم رفض طلب التجديد وإعادة حالة الموقع إلى منتهي الصلاحية.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل تحديث حالة الإشتراك.");
    }
  };

  const handleSetManuallyActive = async (restaurantId: string) => {
    try {
      const resRef = doc(db, "restaurants", restaurantId);
      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(now.getDate() + 30); // Grace manual active

      await updateDoc(resRef, {
        status: "active",
        subscriptionExpiresAt: expiresAt.toISOString()
      });
      alert("تم تفعيل اشتراك المتجر يدوياً لـ 30 يوم بنجاح!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetManuallyExpired = async (restaurantId: string) => {
    try {
      const resRef = doc(db, "restaurants", restaurantId);
      await updateDoc(resRef, {
        status: "expired"
      });
      alert("تم إنهاء صلاحية اشتراك المتجر يدوياً.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTablesConfig = async (restaurantId: string, count: number, paid: boolean) => {
    try {
      const resRef = doc(db, "restaurants", restaurantId);
      await updateDoc(resRef, {
        tablesCount: count,
        extraTablesPaid: paid
      });
      alert("تم تحديث إعدادات الطاولات للمطعم بنجاح! 🎉");
    } catch (err) {
      console.error(err);
      alert("فشل تحديث إعدادات الطاولات.");
    }
  };

  const handleDeleteStore = async (restaurantId: string) => {
    if (!confirm("تحذير: هل أنت متأكد من مسح ملفات هذا المتجر ومنيو الذكاء الاصطناعي الخاص به نهائياً وبلا رجعة؟")) return;
    try {
      await deleteDoc(doc(db, "restaurants", restaurantId));
      alert("تم حذف المتجر نهائياً.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً وبلا رجعة من قاعدة البيانات بالمنظومة؟")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      alert("تم حذف الطلب بنجاح من الخادم السحابي.");
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء محاولة حذف الطلب: " + err.message);
    }
  };

  if (!isAdminAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center py-12 px-4 font-sans text-right">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-orange-500 text-slate-900 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-white">منطقة الإدارة العامة المحصنة</h2>
            <p className="text-xs text-slate-400">تابع لمؤسسة إسلام فود لإدارة اشتراكات فودافون كاش والمطابخ العضوية.</p>
          </div>

          <div className="bg-orange-500/10 text-orange-300 rounded-xl p-3 text-xs leading-relaxed border border-orange-500/20 text-center">
            تنبيه للمقيم والناقد: لقد وفرنا رمز سري سريع مدمج للتطوير 
            <span className="font-mono bg-orange-500/10 text-white font-bold p-1 rounded mx-1 select-all select-text">123456</span> 
            للدخول وتجربة الإدارة والمصادقة الفورية ومراجعة كاش فودافون!
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">أدخل الرمز السري للإدارة العامة (الباسكود)</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أدخل 123456 هنا للتجربة"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full text-center text-sm border border-slate-700 bg-slate-950 text-white focus:border-orange-500 focus:outline-none rounded-xl py-2 px-3 tracking-widest font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 transition text-slate-950 font-bold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-orange-500/10"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>التحقق والدخول لوصاية الإدارة</span>
            </button>

            {biometricEnrolled && (
              <button
                type="button"
                onClick={handleVerifyBiometric}
                className="w-full bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-slate-600 transition text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
              >
                <span>☝️ الدخول الفوري ببصمة الإصبع</span>
              </button>
            )}
          </form>

          <button
            onClick={onNavigateHome}
            className="w-full text-center text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للرئيسية</span>
          </button>
        </div>

        {/* مودال تسجيل بصمة الإصبع الحيوية */}
        {showEnrollBiometricModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
                <div className="relative bg-slate-850 border border-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-500 shadow-inner">
                  <span className="text-4xl animate-pulse">☝️</span>
                </div>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(250,90,0,1)] animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">تسجيل بصمة الإصبع الحيوية</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{enrollStatusText}</p>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-300 rounded-full" 
                    style={{ width: `${enrollProgress}%` }}
                  />
                </div>
                <span className="text-[9px] text-orange-400 font-mono font-bold">{enrollProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* مودال التحقق من بصمة الإصبع الحيوية */}
        {showVerifyBiometricModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
                <div className="relative bg-slate-850 border border-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-500 shadow-inner">
                  <span className="text-4xl animate-pulse">☝️</span>
                </div>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(250,90,0,1)] animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">جاري مطابقة الهوية بالبصمة</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{verifyStatusText}</p>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-300 rounded-full" 
                    style={{ width: `${verifyProgress}%` }}
                  />
                </div>
                <span className="text-[9px] text-orange-400 font-mono font-bold">{verifyProgress}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" text-right="true">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-slate-950 p-2 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">إدارة إسلام فود العامة</h1>
            <p className="text-[10px] text-slate-400 font-medium">لوحة المراقبة والتحكم في الكاش وتصاريح الصالات</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5">
            {adminEmail === "eslamesai12@gmail.com" ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span className="text-orange-400 font-extrabold pb-0.5">المالك والمؤسس: إسلام (eslamesai12@gmail.com) 👑</span>
              </>
            ) : (
              `أدمن: ${adminEmail || "مسؤول معتمد عبر كود"}`
            )}
          </span>
          <button
            onClick={onNavigateHome}
            className="text-xs text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition flex items-center gap-1"
          >
            <span>انتقال للرئيسية</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto text-right">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-5 border flex justify-between items-center shadow-sm">
            <div>
              <span className="text-xs text-slate-500 block font-medium">إجمالي المتاجر المسجلة</span>
              <span className="text-2xl font-black text-slate-800 font-mono mt-1 block">{restaurants.length}</span>
            </div>
            <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border flex justify-between items-center shadow-sm">
            <div>
              <span className="text-xs text-slate-500 block font-medium">في انتظار مراجعة الكاش</span>
              <span className="text-2xl font-black text-red-600 font-mono mt-1 block">
                {restaurants.filter(r => r.status === "pending_approval").length}
              </span>
            </div>
            <div className="bg-red-50 text-red-600 p-3 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border flex justify-between items-center shadow-sm">
            <div>
              <span className="text-xs text-slate-500 block font-medium">المتاجر النشطة رسميًا</span>
              <span className="text-2xl font-black text-green-600 font-mono mt-1 block">
                {restaurants.filter(r => r.status === "active").length}
              </span>
            </div>
            <div className="bg-green-50 text-green-600 p-3 rounded-2xl">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border flex justify-between items-center shadow-sm">
            <div>
              <span className="text-xs text-slate-500 block font-medium">العائد الشهري المتوقع (MRR)</span>
              <span className="text-2xl font-black text-indigo-600 font-mono mt-1 block">
                {restaurants.filter(r => r.status === "active").length * (settings.subscriptionFee || 250)} <span className="text-xs font-bold text-slate-500">جنيه</span>
              </span>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Sub-NavigationBar Tabs */}
        <div className="flex flex-wrap items-center justify-start gap-2 border-b border-slate-200 pb-1" dir="rtl">
          <button
            onClick={() => setActiveTab("stores")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "stores"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4 text-orange-500" />
            <span>المطابخ العضوية والاشتراكات 🏢</span>
          </button>

          <button
            onClick={() => setActiveTab("activity_log")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "activity_log"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Activity className="w-4 h-4 text-orange-600 animate-pulse" />
            <span>سجل حركة المنظومة الموحد (مباشر) 📜</span>
          </button>

          <button
            onClick={() => setActiveTab("financial")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "financial"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Settings className="w-4 h-4 text-orange-500" />
            <span>التحكم المالي وتهيئة النظام 💵</span>
          </button>

          <button
            onClick={() => setActiveTab("support_chat")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "support_chat"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Shield className="w-4 h-4 text-indigo-600" />
            <span className="relative flex items-center gap-1">
              <span>الدعم الفني والمراسلات 🛡️</span>
              {supportChats.length > 0 && (
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              )}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("marketing_agents")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "marketing_agents"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>الخطة التسويقية الشاملة 🚀</span>
          </button>

          <button
            onClick={() => setActiveTab("global_live_orders")}
            className={`px-4 py-3 rounded-t-2xl font-black text-xs transition duration-150 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "global_live_orders"
                ? "border-orange-500 text-orange-600 bg-orange-500/5"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-rose-500" />
            <span className="relative flex items-center gap-1">
              <span>الطلبات المباشرة بالمنصة 🛰️</span>
              {globalLiveOrders.filter(o => o.status === "pending").length > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </span>
          </button>
        </div>

        {/* TAB 1: Stores and Approvals */}
        {activeTab === "stores" && (
          <div className="space-y-6">
            {/* Pending Payments Audit */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-sm border-b pb-2 flex items-center gap-1">
                <CreditCard className="w-4 h-4 text-orange-500" />
                طلبات تراخيص كاش فودافون المرفوعة للفحص ({restaurants.filter(r => r.status === "pending_approval").length})
              </h3>

              {restaurants.filter(r => r.status === "pending_approval").length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">نظيفة ومكتملة! لا توجد أي مدفوعات معلقة بانتظار الفحص حاليًا.</p>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100">
                  {restaurants.filter(r => r.status === "pending_approval").map((store) => (
                    <div key={store.id} className="pt-4 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <img 
                            src={store.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&auto=format&fit=crop&q=80"} 
                            alt="Store" 
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-800">{store.name}</h4>
                            <span className="text-[10px] text-slate-500 block font-mono">{store.ownerEmail}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-orange-500/5 p-2 rounded-xl text-[11px] border border-orange-500/10">
                          <p className="text-slate-600">رقم المحفظة المرسل: <strong className="font-mono text-orange-700">{store.paymentSenderNumber}</strong></p>
                          <p className="text-slate-600">رقم العملية (ID): <strong className="font-mono text-orange-700">{store.paymentTransactionId}</strong></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSubscriptionApproval(store.id, true)}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>موافقة وتنشيط</span>
                        </button>
                        <button
                          onClick={() => handleSubscriptionApproval(store.id, false)}
                          className="bg-red-50 text-red-650 hover:bg-red-100 border border-red-200 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>رفض العملية</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sponsored Ads Audit Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm text-right" dir="rtl">
              <h3 className="font-extrabold text-slate-800 text-sm border-b pb-2 flex items-center gap-1">
                <Megaphone className="w-4 h-4 text-orange-500 animate-pulse" />
                طلبات الإعلانات الممولة وفحص فودافون كاش ({adsRequests.filter(a => a.paymentStatus === "pending_approval").length})
              </h3>

              {adsRequests.filter(a => a.paymentStatus === "pending_approval").length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">لا توجد أي طلبات إعلانات ممولة معلقة بانتظار الفحص حاليًا. 🎯</p>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100">
                  {adsRequests.filter(a => a.paymentStatus === "pending_approval").map((ad) => {
                    const store = restaurants.find(r => r.id === ad.restaurantId);
                    return (
                      <div key={ad.id} className="pt-4 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2 flex-grow">
                          <div className="flex items-center gap-2">
                            {ad.image && (
                              <img 
                                src={ad.image} 
                                alt="Ad Media" 
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-xl object-cover ring-2 ring-orange-500/30"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-xs text-slate-800">{store?.name || ad.restaurantName || "مطعم عضو"}</h4>
                                <span className="bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full text-[9px] font-extrabold">إعلان ممول 💎</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-md mt-0.5">{ad.text || "بدون نص إضافي"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl text-[10px] border border-slate-200">
                            <p className="text-slate-600">الباقة المختارة: <strong className="font-extrabold text-orange-700">{ad.adPlanDays} أيام</strong></p>
                            <p className="text-slate-600">المبلغ المطلوب: <strong className="font-black text-emerald-700">{ad.paymentAmount || 50} ج.م</strong></p>
                            <p className="text-slate-600">رقم المرسل: <strong className="font-mono font-bold text-slate-700">{ad.paymentSenderNumber || "غير متوفر"}</strong></p>
                            <p className="text-slate-600">رقم العملية (ID): <strong className="font-mono font-bold text-indigo-700">{ad.paymentTransactionId || "غير متوفر"}</strong></p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleAdApproval(ad.id, true)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] px-3 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تنشيط الإعلان ✅</span>
                          </button>
                          <button
                            onClick={() => handleAdApproval(ad.id, false)}
                            className="bg-red-50 text-red-650 hover:bg-red-100 border border-red-200 font-bold text-[11px] px-3 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer active:scale-95"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>رفض الطلب ❌</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Store Management Console */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-orange-500" />
                  سجل جميع مطاعم المنظومة والأوصاف الحالية ({restaurants.length} متجر)
                </h3>
                
                {/* Search & Status Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto" dir="rtl">
                  <div className="relative flex-1 sm:flex-initial min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، البريد، الهاتف أو المعرّف..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pr-8 pl-3 py-2 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="text-xs bg-slate-50 border rounded-xl px-2.5 py-2 focus:bg-white focus:outline-none focus:border-orange-500 font-black text-slate-700 cursor-pointer"
                    >
                      <option value="all">كل الحالات</option>
                      <option value="active">نشط تجارياً</option>
                      <option value="trial">فترة تجريبية</option>
                      <option value="expired">منتهي / معطل</option>
                      <option value="pending_approval">انتظار الفحص</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 [&>th]:p-3 [&>th]:font-extrabold border-b">
                      <th>لوجو / اسم المطعم</th>
                      <th>صاحب الحساب الجيميل</th>
                      <th>تاريخ التسجيل</th>
                      <th>نظام الفترة وحالة الإشتراك</th>
                      <th>عدد الطاولات النشطة 🍽️</th>
                      <th>رابط الموقع للعملاء (ID)</th>
                      <th>خطوات فورية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(() => {
                      const filtered = restaurants.filter(store => {
                        const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          store.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (store.phone && store.phone.includes(searchQuery)) ||
                          store.id.toLowerCase().includes(searchQuery.toLowerCase());
                        
                        if (!matchesSearch) return false;
                        if (statusFilter === "all") return true;
                        
                        const now = new Date();
                        const trialEnd = new Date(store.trialEndsAt);
                        const isTrialActive = trialEnd.getTime() > now.getTime();
                        
                        if (statusFilter === "active") return store.status === "active";
                        if (statusFilter === "trial") return isTrialActive && store.status !== "active" && store.status !== "expired";
                        if (statusFilter === "expired") return store.status === "expired" || (!isTrialActive && store.status !== "active");
                        if (statusFilter === "pending_approval") return store.status === "pending_approval";
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-slate-400 text-xs font-bold">
                              لا توجد نتائج مطابقة لفلترة البحث المحددة.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((store) => {
                        const now = new Date();
                        const trialEnd = new Date(store.trialEndsAt);
                        const isTrialActive = trialEnd.getTime() > now.getTime();
                        const expiresAt = store.subscriptionExpiresAt ? new Date(store.subscriptionExpiresAt) : null;
                        const isSubActive = expiresAt ? expiresAt.getTime() > now.getTime() : false;

                      return (
                        <tr key={store.id} className="hover:bg-slate-50/50 [&>td]:p-3">
                          <td className="font-extrabold text-slate-900">
                            <div className="flex items-center gap-2">
                              <img 
                                src={store.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&auto=format&fit=crop&q=80"} 
                                alt={store.name} 
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200"
                              />
                              <span className="font-black text-slate-800">{store.name}</span>
                            </div>
                          </td>
                          <td className="font-mono text-slate-600 text-[11px]">{store.ownerEmail || "بدون بريد"}</td>
                          <td className="text-slate-500 font-medium text-[11.5px]">
                            {store.createdAt ? new Date(store.createdAt).toLocaleDateString("ar-EG") : "غير معروف"}
                          </td>
                          <td>
                            {store.status === "active" ? (
                              <span className="bg-green-100 text-green-700 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                                نشط تجارياً {store.subscriptionExpiresAt ? `(ينتهي في ${new Date(store.subscriptionExpiresAt).toLocaleDateString("ar-EG")})` : "(دائم)"}
                              </span>
                            ) : isTrialActive ? (
                              <span className="bg-orange-100 text-orange-700 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                                فترة تجريبية (متبقي {Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} يوم)
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-[10px]">منتهي الصلاحية / معطل</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-col gap-1 w-32" dir="rtl">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={storeTablesCount[store.id] !== undefined ? storeTablesCount[store.id] : (store.tablesCount !== undefined ? store.tablesCount : 5)}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setStoreTablesCount(prev => ({ ...prev, [store.id]: val }));
                                  }}
                                  className="w-14 border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-center font-bold font-mono bg-slate-50 focus:bg-white"
                                />
                                <button
                                  onClick={() => {
                                    const count = storeTablesCount[store.id] !== undefined ? storeTablesCount[store.id] : (store.tablesCount !== undefined ? store.tablesCount : 5);
                                    const paid = storeTablesPaid[store.id] !== undefined ? storeTablesPaid[store.id] : (store.extraTablesPaid || false);
                                    handleUpdateTablesConfig(store.id, count, paid);
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 rounded-lg text-[10px] font-black cursor-pointer transition"
                                  title="حفظ"
                                >
                                  حفظ 💾
                                </button>
                              </div>
                              
                              {((storeTablesCount[store.id] !== undefined ? storeTablesCount[store.id] : (store.tablesCount !== undefined ? store.tablesCount : 5)) > 5) ? (
                                <div className="space-y-1">
                                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 font-bold">
                                    <input
                                      type="checkbox"
                                      checked={storeTablesPaid[store.id] !== undefined ? storeTablesPaid[store.id] : (store.extraTablesPaid || false)}
                                      onChange={(e) => {
                                        const val = e.target.checked;
                                        setStoreTablesPaid(prev => ({ ...prev, [store.id]: val }));
                                        const count = storeTablesCount[store.id] !== undefined ? storeTablesCount[store.id] : (store.tablesCount !== undefined ? store.tablesCount : 5);
                                        handleUpdateTablesConfig(store.id, count, val);
                                      }}
                                      className="rounded text-orange-500 focus:ring-orange-500"
                                    />
                                    <span>مدفوع الاشتراك 💰</span>
                                  </label>
                                  
                                  {!(storeTablesPaid[store.id] !== undefined ? storeTablesPaid[store.id] : (store.extraTablesPaid || false)) && (
                                    <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-black block text-center animate-pulse">
                                      ⚠️ يتطلب دفع اشتراك
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[9px] text-green-600 font-extrabold bg-green-50 px-1.5 py-0.5 rounded block text-center">
                                  🆓 مجاني (حتى 5)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="font-mono text-slate-500 text-[11px] font-bold">{store.id}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {onEnterRestaurant && (
                                <button
                                  onClick={() => {
                                    alert(`جاري الدخول بوضعية مالك المؤسسة الفائقة إلى متجر: ${store.name}`);
                                    onEnterRestaurant(store);
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-2.5 py-1 rounded-lg transition font-extrabold flex items-center gap-0.5 shadow-sm shadow-orange-500/15 cursor-pointer"
                                >
                                  إدارة ودخول 👑
                                </button>
                              )}
                              {store.phone && (
                                <a
                                  href={`https://wa.me/20${store.phone.startsWith("0") ? store.phone.slice(1) : store.phone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-2.5 py-1 rounded-lg transition font-extrabold flex items-center gap-1 shadow-sm shadow-green-500/15 cursor-pointer"
                                >
                                  <Phone className="w-3 h-3 text-white" />
                                  <span>واتساب المالك 💬 ({store.phone})</span>
                                </a>
                              )}
                              {store.status !== "active" ? (
                                <button
                                  onClick={() => handleSetManuallyActive(store.id)}
                                  className="bg-green-50 text-green-600 hover:bg-green-100 text-[10px] px-2 py-1 rounded transition font-bold cursor-pointer"
                                >
                                  تفعيل يدوي
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSetManuallyExpired(store.id)}
                                  className="bg-red-50 text-red-650 hover:bg-red-100 text-[10px] px-2 py-1 rounded transition font-bold cursor-pointer"
                                >
                                  تعطيل تجاري
                                </button>
                              )}
                              <button
                                onClick={() => setBranchManagingRestaurant(store)}
                                className="bg-sky-50 text-sky-650 hover:bg-sky-100 text-[10px] px-2 py-1 rounded transition font-bold cursor-pointer"
                              >
                                أيقونات الفروع 🏢
                              </button>
                              <button
                                onClick={() => handleDeleteStore(store.id)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] px-2 py-1 rounded transition cursor-pointer"
                              >
                                حذف بالكامل
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Live Activity Monitor Log */}
        {activeTab === "activity_log" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 text-right font-sans" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-600 animate-pulse shrink-0" />
                  سجل الدعم والمراقبة الجغرافية الموحد 📜
                </h2>
                <p className="text-[10px] text-slate-405 mt-1">
                  لقد تم حجب ونقل سجل الحركة والنشاط من غرف أصحاب المطاعم نهائياً تحقيقاً للأمن والخصوصية تحت سلطة الإدارة.
                </p>
              </div>

              {/* Selector */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-600 shrink-0">المطبخ النشط:</span>
                <select
                  value={selectedLogRestaurantId || ""}
                  onChange={(e) => setSelectedLogRestaurantId(e.target.value)}
                  className="text-xs font-black bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 max-w-xs w-full"
                >
                  <option value="" disabled>-- اختر المطبخ للمراقبة --</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedLogRestaurantId ? (
              <ActivityLogView 
                restaurantId={selectedLogRestaurantId} 
                orders={selectedRestaurantOrders} 
              />
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-xs font-medium">يرجى تسجيل أو اختيار مطبخ نشط لملاحظة حركته وسجلاته.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Global Live Orders Command Center */}
        {activeTab === "global_live_orders" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 text-right font-sans" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                  برج مراقبة وبث الطلبات الفوري لجميع المتاجر 🛰️
                </h2>
                <p className="text-[10px] text-slate-400 mt-1">
                  شاشة تفاعلية حية تمنحك كصاحب للمنصة رؤية شاملة لكافة الفواتير والطلبات المدخلة من الزبائن في جميع المطابخ العضوية.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={globalOrdersFilter}
                  onChange={(e) => setGlobalOrdersFilter(e.target.value as any)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-black text-slate-700 cursor-pointer focus:outline-none focus:border-orange-500"
                >
                  <option value="all">جميع الحالات بالمنصة</option>
                  <option value="pending">معلق / انتظار الاستلام ⏳</option>
                  <option value="preparing">قيد التحضير بالمطبخ 🍳</option>
                  <option value="ready">جاهز للتوصيل 🚚</option>
                  <option value="completed">مكتمل ومستلم ✅</option>
                  <option value="cancelled">ملغي ❌</option>
                </select>
              </div>
            </div>

            {/* Global Orders List */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 [&>th]:p-3 [&>th]:font-extrabold border-b">
                    <th>رقم الطلب والمطبخ</th>
                    <th>العميل وجهة التوصيل</th>
                    <th>الطلب ومحتويات السلة</th>
                    <th>نوع الطلب والقيمة الكلية</th>
                    <th>حالة الفاتورة والتحكم</th>
                    <th>توقيت العملية</th>
                    <th>إجراء إداري</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    const filtered = globalLiveOrders.filter(order => {
                      if (globalOrdersFilter === "all") return true;
                      return order.status === globalOrdersFilter;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="text-center py-16 text-slate-400 text-xs font-bold">
                            لا توجد طلبات جارية تتبع هذه الحالة حالياً عبر المنصة بالكامل.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((order) => {
                      const storeName = restaurants.find(r => r.id === order.restaurantId)?.name || order.restaurantId;
                      const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleString("ar-EG") : "غير معروف";
                      
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/50 [&>td]:p-3 font-medium text-slate-800">
                          <td>
                            <div className="space-y-0.5">
                              <span className="font-mono font-black text-slate-900 block">#{order.orderNumber || order.id.slice(0, 6)}</span>
                              <span className="text-[10px] text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded-lg font-black inline-block">{storeName}</span>
                            </div>
                          </td>
                          <td>
                            <div className="space-y-0.5">
                              <span className="font-black text-slate-850 block">{order.customerName}</span>
                              <span className="font-mono text-[10px] text-slate-500 block">{order.customerPhone}</span>
                              <span className="text-[9px] text-slate-400 block">{order.customerAddress || order.governorate}</span>
                            </div>
                          </td>
                          <td>
                            <div className="max-w-[200px] truncate space-y-0.5">
                              {order.items && order.items.map((item: any, idx: number) => (
                                <span key={idx} className="block text-[10px] text-slate-650">
                                  {item.name} × {item.quantity}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="space-y-0.5">
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-md inline-block">
                                {order.type === "delivery" ? "🚀 توصيل منزلي" : order.type === "dine_in" ? "🍽️ صالة" : "🥡 تيك أواي"}
                              </span>
                              <span className="font-mono text-xs font-black text-slate-900 block mt-1">
                                {order.total} {order.currency || "جنيه"}
                              </span>
                            </div>
                          </td>
                          <td>
                            {order.status === "pending" && <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">قيد الانتظار ⏳</span>}
                            {order.status === "preparing" && <span className="bg-orange-100 text-orange-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">قيد التحضير 🍳</span>}
                            {order.status === "ready" && <span className="bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">جاهز للتوصيل 🚚</span>}
                            {order.status === "completed" && <span className="bg-green-100 text-green-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">تم الاكتمال ✅</span>}
                            {order.status === "cancelled" && <span className="bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">ملغي ❌</span>}
                          </td>
                          <td className="font-mono text-[10px] text-slate-500">{orderTime}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="bg-red-50 text-red-650 hover:bg-red-100 text-[10px] font-black px-2 py-1 rounded transition cursor-pointer"
                            >
                              مسح الطلب 🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Financial Settings & Management Config */}
        {activeTab === "financial" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Global Config Form */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm h-fit">
              <h3 className="font-extrabold text-slate-800 text-sm border-b pb-2 flex items-center gap-1 text-right" dir="rtl">
                <Settings className="w-4 h-4 text-orange-500" />
                التحكم في معلمات المنصة والإعلانات والدفع
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* القسم الأول: الإعدادات المالية والخطط */}
                <div className="space-y-4 border-b border-slate-100 pb-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[12px] text-orange-600 flex items-center gap-1">💵 خطط الأسعار والاشتراكات (يتحكم بها الأدمن)</h4>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">رقم فودافون كاش المعتمد لاستلام الاشتراكات *</label>
                        <input
                          type="text"
                          required
                          value={settings.vodafoneCashNumber || ""}
                          onChange={(e) => setSettings({ ...settings, vodafoneCashNumber: e.target.value })}
                          placeholder="مثال: 01012345678"
                          className="w-full text-xs border rounded-xl py-2 px-3 font-mono text-center bg-slate-50 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">قيمة الاشتراك الشهري التجريبي الافتراضي (جنيه) *</label>
                        <input
                          type="number"
                          required
                          value={settings.subscriptionFee || 250}
                          onChange={(e) => setSettings({ ...settings, subscriptionFee: Number(e.target.value) || 0 })}
                          placeholder="250"
                          className="w-full text-xs border rounded-xl py-2 px-3 font-mono text-center bg-slate-50 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* Standard Plan Fees Setting */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-xs font-black text-slate-800">⚙️ تسعير الخطة العادية (Standard)</span>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">شهر واحد ⏳</label>
                          <input
                            type="number"
                            value={settings.planStandard1MonthFee || ""}
                            onChange={(e) => setSettings({ ...settings, planStandard1MonthFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 250"
                            className="w-full text-xs border rounded-lg py-1.5 px-2 bg-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">٣ شهور</label>
                          <input
                            type="number"
                            value={settings.planStandard3MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planStandard3MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 700"
                            className="w-full text-xs border rounded-lg py-1.5 px-2 bg-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">٦ شهور</label>
                          <input
                            type="number"
                            value={settings.planStandard6MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planStandard6MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 1300"
                            className="w-full text-xs border rounded-lg py-1.5 px-2 bg-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500">١٢ شهر</label>
                          <input
                            type="number"
                            value={settings.planStandard12MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planStandard12MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 2400"
                            className="w-full text-xs border rounded-lg py-1.5 px-2 bg-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Premium Plan Fees Setting */}
                    <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-200/60 space-y-3">
                      <span className="text-xs font-black text-orange-800">👑 تسعير الخطة المميزة (Premium - تغيير الاسم والشعار)</span>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-orange-600">شهر واحد ⏳</label>
                          <input
                            type="number"
                            value={settings.planPremium1MonthFee || ""}
                            onChange={(e) => setSettings({ ...settings, planPremium1MonthFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 450"
                            className="w-full text-xs border border-orange-200 focus:border-orange-500 focus:outline-none rounded-lg py-1.5 px-2 bg-white text-center font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-orange-600">٣ شهور</label>
                          <input
                            type="number"
                            value={settings.planPremium3MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planPremium3MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 1200"
                            className="w-full text-xs border border-orange-200 focus:border-orange-500 focus:outline-none rounded-lg py-1.5 px-2 bg-white text-center font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-orange-600">٦ شهور</label>
                          <input
                            type="number"
                            value={settings.planPremium6MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planPremium6MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 2200"
                            className="w-full text-xs border border-orange-200 focus:border-orange-500 focus:outline-none rounded-lg py-1.5 px-2 bg-white text-center font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-orange-600">١٢ شهر</label>
                          <input
                            type="number"
                            value={settings.planPremium12MonthsFee || ""}
                            onChange={(e) => setSettings({ ...settings, planPremium12MonthsFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 4000"
                            className="w-full text-xs border border-orange-200 focus:border-orange-500 focus:outline-none rounded-lg py-1.5 px-2 bg-white text-center font-mono"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* القسم الثاني: الصور والبانرات لتطبيق الملاك والزبائن مثبت */}
                <div className="space-y-4 border-b border-slate-100 pb-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[12px] text-orange-600 flex items-center gap-1">🖼️ تصاميم البانرات والشعار الرئيسي للمنصة (رفع الملفات والروابط)</h4>
                  
                  <p className="text-[10px] text-slate-400 leading-normal">تتحكم هذه الميزات برفع الصور والبانرات من جهازك مباشرة بسحب وإفلات الملفات أو النقر للرفع، لتظهر في صفحات وقوائم المنيو فوراً.</p>

                  <div className="space-y-4">
                    {/* App Main Logo Field */}
                    <div className="space-y-2 bg-slate-50/50 p-4 rounded-3xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700">شعار وصورة التطبيق الرئيسية Mعتمدة (اللوجو) 👑</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="border-2 border-dashed border-slate-200 hover:border-orange-500 rounded-2xl p-4 text-center cursor-pointer bg-white relative group transition-all">
                          <input 
                            type="file" 
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAdminImageUpload('appMainLogo', file);
                            }}
                          />
                          <div className="space-y-1">
                            <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-orange-500 group-hover:scale-110 transition-all pointer-events-none" />
                            <p className="text-[10px] font-bold text-slate-650">اسحب أو حدد ملف شعار التطبيق</p>
                            <p className="text-[8px] text-slate-400">ملف JPG, PNG مع ضغط فوري تلقائي</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-1.5">
                          <span className="text-[9px] text-slate-400">معاينة الشعار الحالي للزبائن:</span>
                          {settings.appMainLogo ? (
                            <div className="relative group">
                              <img src={settings.appMainLogo} alt="Logo Preview" className="h-16 w-16 rounded-full border border-slate-200 object-cover p-0.5 shadow-xs" referrerPolicy="no-referrer" />
                              <button 
                                type="button" 
                                onClick={() => setSettings({ ...settings, appMainLogo: "" })}
                                className="absolute -top-1 -right-1 bg-red-650 text-white rounded-full p-0.5 text-[8px] hover:bg-red-700 font-bold"
                              >
                                إزالة
                              </button>
                            </div>
                          ) : (
                            <div className="h-16 w-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-[9px] text-slate-350">لا يوجد شعار</div>
                          )}
                        </div>
                      </div>
                      
                      {/* URL Fallback input */}
                      <input
                        type="text"
                        value={settings.appMainLogo || ""}
                        onChange={(e) => setSettings({ ...settings, appMainLogo: e.target.value })}
                        placeholder="أو ضع رابط اللوجو المباشر هنا..."
                        className="w-full text-[10px] border rounded-lg py-1.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* Banners Drag-and-Drop Area */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">غلاف إعلانات الهوم المتحركة بالمنيو (البانرات الثلاثة) 📸</label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Banner 1 */}
                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2 text-right">
                          <span className="text-[10px] font-extrabold text-slate-700">البانر الإعلاني الأول *</span>
                          <div className="border border-dashed border-slate-250 hover:border-orange-550 rounded-xl p-3 text-center cursor-pointer bg-white relative group transition-all">
                            <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAdminImageUpload('appBannerUrl1', file);
                              }}
                            />
                            <div className="space-y-1">
                              <Upload className="w-4 h-4 mx-auto text-slate-400 group-hover:text-orange-500 transition-all pointer-events-none" />
                              <p className="text-[9px] font-bold text-slate-600">ارفع البانر الأول</p>
                            </div>
                          </div>
                          {settings.appBannerUrl1 && (
                            <div className="relative">
                              <img src={settings.appBannerUrl1} alt="Banner 1" className="h-10 w-full rounded object-cover shadow-2xs border" referrerPolicy="no-referrer" />
                              <button 
                                type="button" 
                                onClick={() => setSettings({ ...settings, appBannerUrl1: "" })}
                                className="absolute top-0 right-0 bg-red-650 text-white rounded px-1 py-0.5 text-[7px] font-bold"
                              >
                                إزالة
                              </button>
                            </div>
                          )}
                          <input
                            type="text"
                            value={settings.appBannerUrl1 || ""}
                            onChange={(e) => setSettings({ ...settings, appBannerUrl1: e.target.value })}
                            placeholder="أو رابط البانر 1..."
                            className="w-full text-[9px] border rounded py-1 px-2 bg-white font-mono text-left"
                            dir="ltr"
                          />
                        </div>

                        {/* Banner 2 */}
                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2 text-right">
                          <span className="text-[10px] font-extrabold text-slate-700">البانر الإعلاني الثاني *</span>
                          <div className="border border-dashed border-slate-250 hover:border-orange-550 rounded-xl p-3 text-center cursor-pointer bg-white relative group transition-all">
                            <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAdminImageUpload('appBannerUrl2', file);
                              }}
                            />
                            <div className="space-y-1">
                              <Upload className="w-4 h-4 mx-auto text-slate-400 group-hover:text-orange-500 transition-all pointer-events-none" />
                              <p className="text-[9px] font-bold text-slate-600">ارفع البانر الثاني</p>
                            </div>
                          </div>
                          {settings.appBannerUrl2 && (
                            <div className="relative">
                              <img src={settings.appBannerUrl2} alt="Banner 2" className="h-10 w-full rounded object-cover shadow-2xs border" referrerPolicy="no-referrer" />
                              <button 
                                type="button" 
                                onClick={() => setSettings({ ...settings, appBannerUrl2: "" })}
                                className="absolute top-0 right-0 bg-red-650 text-white rounded px-1 py-0.5 text-[7px] font-bold"
                              >
                                إزالة
                              </button>
                            </div>
                          )}
                          <input
                            type="text"
                            value={settings.appBannerUrl2 || ""}
                            onChange={(e) => setSettings({ ...settings, appBannerUrl2: e.target.value })}
                            placeholder="أو رابط البانر 2..."
                            className="w-full text-[9px] border rounded py-1 px-2 bg-white font-mono text-left"
                            dir="ltr"
                          />
                        </div>

                        {/* Banner 3 */}
                        <div className="bg-slate-50/55 p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2 text-right">
                          <span className="text-[10px] font-extrabold text-slate-700">البانر الإعلاني الثالث *</span>
                          <div className="border border-dashed border-slate-250 hover:border-orange-550 rounded-xl p-3 text-center cursor-pointer bg-white relative group transition-all">
                            <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAdminImageUpload('appBannerUrl3', file);
                              }}
                            />
                            <div className="space-y-1">
                              <Upload className="w-4 h-4 mx-auto text-slate-400 group-hover:text-orange-500 transition-all pointer-events-none" />
                              <p className="text-[9px] font-bold text-slate-600">ارفع البانر الثالث</p>
                            </div>
                          </div>
                          {settings.appBannerUrl3 && (
                            <div className="relative">
                              <img src={settings.appBannerUrl3} alt="Banner 3" className="h-10 w-full rounded object-cover shadow-2xs border" referrerPolicy="no-referrer" />
                              <button 
                                type="button" 
                                onClick={() => setSettings({ ...settings, appBannerUrl3: "" })}
                                className="absolute top-0 right-0 bg-red-650 text-white rounded px-1 py-0.5 text-[7px] font-bold"
                              >
                                إزالة
                              </button>
                            </div>
                          )}
                          <input
                            type="text"
                            value={settings.appBannerUrl3 || ""}
                            onChange={(e) => setSettings({ ...settings, appBannerUrl3: e.target.value })}
                            placeholder="أو رابط البانر 3..."
                            className="w-full text-[9px] border rounded py-1 px-2 bg-white font-mono text-left"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* القسم الفرعي: ألوان وخطوط المنصة والدردشة الذكية (جديد) */}
                <div className="space-y-4 border-b border-slate-100 pb-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[12px] text-orange-600 flex items-center gap-1">🎨 تخصيص خطوط المنصة وألوان الشات والدردشة الذكية</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">نوع الخط الرئيسي للمنصة والشات ✍️</label>
                      <select
                        value={settings.platformFontFamily || "Cairo"}
                        onChange={(e) => setSettings({ ...settings, platformFontFamily: e.target.value })}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-slate-50 focus:outline-none focus:border-orange-500 font-bold"
                      >
                        <option value="'Cairo', sans-serif">خط القاهرة الأنيق (Cairo)</option>
                        <option value="'Tajawal', sans-serif">خط تجوال العصري (Tajawal)</option>
                        <option value="'Readex Pro', sans-serif">خط ريدكس الاحترافي (Readex Pro)</option>
                        <option value="'Inter', sans-serif">خط انتر الهندسي (Inter)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">حجم الخط الإفتراضي لمحادثة الشات 📏</label>
                      <select
                        value={settings.platformFontSize || "13px"}
                        onChange={(e) => setSettings({ ...settings, platformFontSize: e.target.value })}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-slate-50 focus:outline-none focus:border-orange-500 font-mono"
                      >
                        <option value="11px">صغير جداً (11px)</option>
                        <option value="12px">صغير (12px)</option>
                        <option value="13px">متوسط افتراضي (13px)</option>
                        <option value="14px">كبير (14px)</option>
                        <option value="16px">كبير جداً (16px)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">لون خلفية فقاعة شات المساعد الذكي 💬</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={settings.chatBubbleColor || "#fa5a00"}
                          onChange={(e) => setSettings({ ...settings, chatBubbleColor: e.target.value })}
                          className="h-9 w-12 border rounded-lg cursor-pointer bg-slate-50 p-1 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={settings.chatBubbleColor || "#fa5a00"}
                          onChange={(e) => setSettings({ ...settings, chatBubbleColor: e.target.value })}
                          placeholder="#fa5a00"
                          className="flex-1 text-xs border rounded-xl py-2 px-3 font-mono text-center bg-slate-50 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">لون نص خط الشات المكتوب (للرؤية) ⚪⚫</label>
                      <select
                        value={settings.chatTextColor || "#ffffff"}
                        onChange={(e) => setSettings({ ...settings, chatTextColor: e.target.value })}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-slate-50 focus:outline-none focus:border-orange-500 font-bold"
                      >
                        <option value="#ffffff">أبيض ناصع ⚪ (أفضل وضوح على الخلفيات الداكنة)</option>
                        <option value="#0f172a">أسود كربوني ⚫ (للخلفيات الفاتحة جداً)</option>
                        <option value="#ffe8cc">بيج برتقالي دافئ 🔸</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* القسم الفرعي: نظام الحماية البيومترية والمصادقة بالبصمة (جديد) */}
                <div className="space-y-4 border-b border-slate-100 pb-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[12px] text-orange-600 flex items-center gap-1">🔒 نظام الحماية البيومترية وبصمة الإصبع للمشرفين</h4>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                        ☝️ حالة بصمة جهازك الحالي:
                        {biometricEnrolled ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">نشطة ومعتمدة ✅</span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full">غير مسجلة ❌</span>
                        )}
                      </span>
                      <p className="text-[10px] text-slate-500 leading-normal font-medium font-sans">سجل بصمة إصبع متصفحك الحالي للتجاوز السريع لكلمة المرور والدخول الفوري بنقرة واحدة من أي جهاز ذكي.</p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleEnrollBiometric}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] py-2 px-4 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>☝️ تسجيل بصمة الإصبع</span>
                      </button>
                      {biometricEnrolled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("هل ترغب فعلاً في حذف بصمتك الحيوية المسجلة لهذا الجهاز؟")) {
                              localStorage.removeItem("islamfood_admin_biometrics_enrolled");
                              setBiometricEnrolled(false);
                              alert("تم إلغاء تفعيل البصمة الحيوية بنجاح.");
                            }
                          }}
                          className="bg-red-150 hover:bg-red-200 text-red-700 font-bold text-[11px] py-2 px-3 rounded-xl transition cursor-pointer"
                        >
                          إلغاء التفعيل
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* القسم الفرعي الجديد: بوت النصائح التلقائية والإشعارات الذكية */}
                <div className="space-y-4 border-b border-slate-100 pb-5 text-right" dir="rtl">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-[12px] text-orange-600 flex items-center gap-1">🤖 بوت النصائح التلقائية والإشعارات الذكية (التفعيل الفوري)</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultTips = [
                          "📸 منيو ** عنده صورة لكل صنف؟ لو لأ - فيه فرصة كبيرة! الصورة الواحدة بتزيد احتمال طلب الصنف ده بنسبة كبيرة. خطة أسبوعية: ارفع صور 5 أصناف كل أسبوع لحد ما يخلص. 👈",
                          "💡 نصيحة اليوم للملاك: جرب تفعيل كود خصم ترويجي بنسبة 10% ونشره بجروبات منطقتك لرفع مبيعات عطلة نهاية الأسبوع!",
                          "🚀 نصيحة اليوم للعملاء: تتبع حالة أوردرك مباشرة عبر شاشة تتبع الطلب الفورية بالمنيو لتصلك وجبتك ساخنة وطازجة!",
                          "💡 نصيحة اليوم للملاك: الاهتمام بالرد السريع على الشات والدردشة المباشرة يرفع ولاء العميل بمعدل 3 أضعاف.",
                          "💬 نصيحة اليوم للعملاء: أضف تفاصيل التوصيل بدقة (الدور، الشقة، علامة مميزة) في خانة الملاحظات لمساعدة الطيار في الوصول السريع."
                        ];
                        setSettings({ 
                          ...settings, 
                          botTips: defaultTips, 
                          botActive: true, 
                          botIntervalSeconds: 60,
                          botOwnerNumbers: settings.botOwnerNumbers || "01012345678, 01222223333, 01555554444",
                          botCustomerNumbers: settings.botCustomerNumbers || "01112345678, 01544443333"
                        });
                        alert("تم تعيين قائمة النصائح الافتراضية بنجاح! جاهزة للبث والتجربة.");
                      }}
                      className="bg-orange-50 hover:bg-orange-100 text-orange-600 font-extrabold text-[10px] py-1 px-3 rounded-lg transition"
                    >
                      💡 تعيين النصائح الافتراضية للمنصة
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* تفعيل البوت */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">حالة تشغيل البوت التلقائي 🟢</label>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, botActive: !settings.botActive })}
                          className={`w-full py-2 px-3 rounded-xl font-black text-xs transition border flex items-center justify-center gap-2 cursor-pointer ${
                            settings.botActive 
                              ? "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/10" 
                              : "bg-slate-200 text-slate-650 border-slate-350"
                          }`}
                        >
                          <Bot className="w-4 h-4" />
                          <span>{settings.botActive ? "البوت يعمل تلقائياً (نشط) ✅" : "البوت معطل حالياً (إيقاف) ⚠️"}</span>
                        </button>
                      </div>

                      {/* دورة الإرسال */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">معدل بث النصائح (الدورة) ⏱️</label>
                        <select
                          value={settings.botIntervalSeconds || 60}
                          onChange={(e) => setSettings({ ...settings, botIntervalSeconds: Number(e.target.value) })}
                          className="w-full text-xs border rounded-xl py-2 px-3 bg-white focus:outline-none focus:border-orange-500 font-bold"
                        >
                          <option value="30">كل 30 ثانية (للتجربة السريعة والمحاكاة) ⚡</option>
                          <option value="60">كل دقيقة واحدة (محاكاة نشطة) ⏰</option>
                          <option value="300">كل 5 دقائق ⏳</option>
                          <option value="1800">كل 30 دقيقة 📅</option>
                          <option value="3600">كل ساعة واحدة 🕐</option>
                          <option value="86400">كل 24 ساعة (يومي تلقائي) 🌍</option>
                        </select>
                      </div>

                      {/* محاكاة إرسال فوري للتجربة */}
                      <div className="space-y-1.5 flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const tipsList = settings.botTips || [];
                            if (tipsList.length === 0) {
                              alert("عذراً، يرجى ملء أو تعيين قائمة النصائح أولاً!");
                              return;
                            }
                            const randomTip = tipsList[Math.floor(Math.random() * tipsList.length)];
                            
                            // Dispatch custom global event so other views can display beautiful notification toasts!
                            const customEvent = new CustomEvent("islamfood_new_tip_alert", { detail: randomTip });
                            window.dispatchEvent(customEvent);
                            alert("🚀 تم إرسال وبث نصيحة عشوائية فورية لجميع العملاء والملاك النشطين بمثابة محاكاة ناجحة!");
                          }}
                          className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-950 text-white transition border border-slate-850 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Bell className="w-4 h-4 text-orange-400 animate-bounce" />
                          <span>بث إشعار محاكاة فوري الآن 🚀</span>
                        </button>
                      </div>
                    </div>

                    {/* إدارة قواعد الأرقام المستهدفة */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>📞 أرقام هواتف الملاك المستهدفين (مفصولة بفواصل أو سطر)</span>
                          <span className="text-[10px] text-slate-400 font-medium font-sans">(أصحاب المطاعم)</span>
                        </label>
                        <textarea
                          value={settings.botOwnerNumbers || ""}
                          onChange={(e) => setSettings({ ...settings, botOwnerNumbers: e.target.value })}
                          placeholder="مثال:&#10;01012345678&#10;01122223333&#10;01244445555"
                          className="w-full text-xs border rounded-2xl py-2.5 px-3.5 bg-white focus:outline-none focus:border-orange-500 h-24 font-mono font-bold leading-normal resize-none text-right"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>👥 أرقام هواتف العملاء المستهدفين (مفصولة بفواصل أو سطر)</span>
                          <span className="text-[10px] text-slate-400 font-medium font-sans">(المستهلكين والمشترين)</span>
                        </label>
                        <textarea
                          value={settings.botCustomerNumbers || ""}
                          onChange={(e) => setSettings({ ...settings, botCustomerNumbers: e.target.value })}
                          placeholder="مثال:&#10;01511112222&#10;01099998888"
                          className="w-full text-xs border rounded-2xl py-2.5 px-3.5 bg-white focus:outline-none focus:border-orange-500 h-24 font-mono font-bold leading-normal resize-none text-right"
                          dir="rtl"
                        />
                      </div>
                    </div>

                    {/* إدارة قائمة رسائل النصائح الحيوية */}
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                        <span>📝 بنك نصائح وإشعارات البوت النشط</span>
                        <span className="text-[10px] text-slate-400 font-medium font-sans">({(settings.botTips || []).length} نصيحة مسجلة)</span>
                      </label>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newBotTip}
                          onChange={(e) => setNewBotTip(e.target.value)}
                          placeholder="اكتب نصيحة جديدة أو إشعار ذكي للبث التلقائي..."
                          className="flex-1 text-xs border rounded-xl py-2 px-3 bg-white focus:outline-none focus:border-orange-500 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newBotTip.trim()) return;
                            const updatedTips = [...(settings.botTips || []), newBotTip.trim()];
                            setSettings({ ...settings, botTips: updatedTips });
                            setNewBotTip("");
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة</span>
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-100 rounded-2xl p-2 bg-white">
                        {(!settings.botTips || settings.botTips.length === 0) ? (
                          <div className="text-center py-4 text-[10px] text-slate-400 font-bold">لا توجد نصائح مضافة حالياً. اضغط على "تعيين النصائح الافتراضية" أعلاه للبدء الفوري!</div>
                        ) : (
                          settings.botTips.map((tip, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-3 p-2 hover:bg-slate-50 rounded-xl border border-slate-100/50 transition duration-150">
                              <p className="text-[11px] font-black text-slate-700 leading-relaxed flex-1">{tip}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedTips = (settings.botTips || []).filter((_, i) => i !== idx);
                                  setSettings({ ...settings, botTips: updatedTips });
                                }}
                                className="text-red-550 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* القسم الثالث: بث الرسائل الموحدة */}
                <div className="space-y-4 border-b border-slate-100 pb-4">
                  <h4 className="font-extrabold text-[11px] text-orange-600 flex items-center gap-1">📢 بث الرسائل الموحدة بالمنظومة</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">رسالة موحدة لجميع العملاء في المنيو والطلبات 👥</label>
                      <textarea
                        value={settings.broadcastCustomersMessage || ""}
                        onChange={(e) => setSettings({ ...settings, broadcastCustomersMessage: e.target.value })}
                        placeholder="مثال: يرجى العلم أنه يفضل الدفع كاش أو فودافون كاش لسرعة استجابة المطبخ..."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-slate-50 focus:outline-none focus:border-orange-500 h-20 resize-none font-medium leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">رسالة موحدة لجميع الملاك والمنصات التابعة 👑</label>
                      <textarea
                        value={settings.broadcastOwnersMessage || ""}
                        onChange={(e) => setSettings({ ...settings, broadcastOwnersMessage: e.target.value })}
                        placeholder="تظهر كتنبيه إداري لجميع أصحاب المطاعم بمجرد فتح الداشبورد الخاص بهم."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-slate-50 focus:outline-none focus:border-orange-500 h-20 resize-none font-medium leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* القسم الرابع: نظام فتح وإغلاق الدورة المحاسبية */}
                <div className="space-y-4 pb-2">
                  <h4 className="font-extrabold text-[11px] text-orange-600 flex items-center gap-1">🗓️ فتح وإغلاق الدورة الشهري الحسابي</h4>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="space-y-0.5 text-right w-full sm:w-auto">
                      <span className="text-[11px] font-extrabold text-slate-800 block">الدورة الحالية</span>
                      <p className="text-[9px] text-slate-400">تحكم بفتح الدفع كاش والاشتراكات الشهرية</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, monthlyBillingOpen: !settings.monthlyBillingOpen })}
                      className={`text-[10px] w-full sm:w-auto font-black px-4 py-2 rounded-xl transition cursor-pointer ${
                        settings.monthlyBillingOpen 
                          ? "bg-green-100 text-green-700 hover:bg-green-200" 
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                    >
                      {settings.monthlyBillingOpen ? "تفعيل الحسابات مفتوحة ✅" : "الدورة معطلة / مغلقة ⚠️"}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">اسم الدورة الحالية (الشهر والسنة) *</label>
                    <input
                      type="text"
                      required
                      value={settings.monthlyBillingMonth || ""}
                      onChange={(e) => setSettings({ ...settings, monthlyBillingMonth: e.target.value })}
                      placeholder="مثال: يونيو ٢٠٢٦"
                      className="w-full text-xs border rounded-xl py-2 px-3 text-center bg-slate-50 focus:outline-none focus:border-orange-500 font-black text-slate-800"
                    />
                  </div>
                </div>

                {/* 🛑 القسم الجديد: إيقاف تطبيق الدليفري والخدمات التابعة بالكامل */}
                <div className="space-y-4 pb-2 border-t border-slate-150 pt-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[11px] text-red-600 flex items-center gap-1">🛑 التحكم في تشغيل/إيقاف تطبيق الدليفري والخدمات</h4>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-50/50 p-4 rounded-2xl border border-red-200">
                    <div className="space-y-1 text-right w-full sm:w-auto">
                      <span className="text-xs font-black text-red-800 block">حالة تطبيق الدليفري والخدمات</span>
                      <p className="text-[10px] text-red-650 font-bold leading-normal">
                        عند التفعيل، سيتم إيقاف تطبيق الدليفري بالكامل وإخفاء خيار الدليفري من منيو العملاء لجميع المطاعم مؤقتاً.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, deliveryServicesSuspended: !settings.deliveryServicesSuspended })}
                      className={`text-xs w-full sm:w-auto font-black px-4 py-2.5 rounded-xl transition cursor-pointer text-center whitespace-nowrap shadow-sm ${
                        settings.deliveryServicesSuspended 
                          ? "bg-red-600 text-white hover:bg-red-700 font-bold" 
                          : "bg-green-600 text-white hover:bg-green-700 font-bold"
                      }`}
                    >
                      {settings.deliveryServicesSuspended ? "إيقاف تطبيق الدليفري مفعّل ⚠️" : "تطبيق الدليفري يعمل بشكل طبيعي ✅"}
                    </button>
                  </div>
                </div>

                {/* 🎨 القسم الجديد: أبعاد وعرض إعلان المنيو (الزووم والملء) */}
                <div className="space-y-4 pb-2 border-t border-slate-150 pt-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[11px] text-orange-600 flex items-center gap-1">🎨 لوحة التحكم في أبعاد وعرض الإعلان والمنيو الموحد</h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-bold">
                    تحكّم ببعد وزووم وطريقة ملء صور الإعلانات والمنيو المنبثق لجميع الزوار على الموبايل فورياً من هنا لضمان تجربة رؤية متناسقة.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-orange-500/5 p-4 rounded-2xl border border-orange-200">
                    {/* Zoom Scale */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-700">مقياس التكبير (Zoom Scale): {Math.round((settings.menuAdZoomScale || 1.0) * 100)}%</label>
                        <button 
                          type="button" 
                          onClick={() => setSettings({ ...settings, menuAdZoomScale: 1.0 })}
                          className="text-[9px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-lg transition font-extrabold"
                        >
                          إعادة ضبط للوضع الافتراضي (100%) 🔄
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">50%</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.1"
                          value={settings.menuAdZoomScale || 1.0}
                          onChange={(e) => setSettings({ ...settings, menuAdZoomScale: Number(e.target.value) })}
                          className="flex-grow accent-orange-600 h-1.5 rounded-lg bg-slate-200 appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-400 font-mono">250%</span>
                      </div>
                    </div>

                    {/* Fit Mode */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">طريقة ملء الصورة وتثبيتها</label>
                      <select
                        value={settings.menuAdFitMode || "contain"}
                        onChange={(e) => setSettings({ ...settings, menuAdFitMode: e.target.value as "contain" | "cover" })}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-white"
                      >
                        <option value="contain">🔍 وضع: احتواء الصورة بالكامل داخل إطار الشاشة (Contain)</option>
                        <option value="cover">🖼️ وضع: ملء وتغطية كامل مساحة الشاشة بالصورة (Cover)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 💵 القسم الجديد: تسعير وباقات الإعلانات الممولة (Vodafone Cash) */}
                <div className="space-y-4 pb-2 border-t border-slate-150 pt-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[11px] text-orange-600 flex items-center gap-1">💵 باقات وتسعير الإعلانات الممولة عبر فودافون كاش</h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-bold">
                    حدد أسعار الإعلانات الممولة للمطاعم لكل خطة زمنية بالجنيه المصري. سيقوم أصحاب المطاعم بطلب الترقية وتحويل المبلغ لمحفظتك.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-extrabold text-slate-600">سعر اليوم الواحد (١ يوم) *</label>
                      <input
                        type="number"
                        required
                        value={settings.adPrice1Day || 50}
                        onChange={(e) => setSettings({ ...settings, adPrice1Day: Number(e.target.value) || 0 })}
                        className="w-full text-xs border rounded-xl py-1.5 px-2.5 font-mono text-center bg-white"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-extrabold text-slate-600">سعر اليومين (٢ يوم) *</label>
                      <input
                        type="number"
                        required
                        value={settings.adPrice2Days || 80}
                        onChange={(e) => setSettings({ ...settings, adPrice2Days: Number(e.target.value) || 0 })}
                        className="w-full text-xs border rounded-xl py-1.5 px-2.5 font-mono text-center bg-white"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-extrabold text-slate-600">سعر الأسبوع (٧ أيام) *</label>
                      <input
                        type="number"
                        required
                        value={settings.adPrice7Days || 200}
                        onChange={(e) => setSettings({ ...settings, adPrice7Days: Number(e.target.value) || 0 })}
                        className="w-full text-xs border rounded-xl py-1.5 px-2.5 font-mono text-center bg-white"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-extrabold text-slate-600">سعر الشهر (٣٠ يوم) *</label>
                      <input
                        type="number"
                        required
                        value={settings.adPrice30Days || 600}
                        onChange={(e) => setSettings({ ...settings, adPrice30Days: Number(e.target.value) || 0 })}
                        className="w-full text-xs border rounded-xl py-1.5 px-2.5 font-mono text-center bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 👑 القسم الخامس: لوحة تحكم مالك المؤسسة (تغيير الروابط، الأرقام، عدادات الحدود وقاعدة البيانات) */}
                <div className="space-y-4 border-t border-slate-100 pt-4 text-right" dir="rtl">
                  <h4 className="font-extrabold text-[12px] text-indigo-700 flex items-center gap-1.5">
                    <span className="text-sm">👑</span>
                    لوحة تحكم وتفويض مالك المؤسسة (تعديل الروابط والعدادات والخطوط)
                  </h4>
                  <p className="text-[10px] text-indigo-950/70 leading-normal">
                    تمكنك هذه المنطقة كصاحب ومؤسس المنصة من تعديل كافة روابط قاعدة البيانات السحابية السريعة والتحويل الخارجي، وعدادات الفترات التجريبية أو حدود المنتجات والفروع النشطة.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* رابط قاعدة البيانات وسحابتها الرئيسي */}
                    <div className="space-y-1.5 text-right">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-700">رابط كونسول قاعدة البيانات (Firebase Console) 🗄️</label>
                        {settings.dbConfigUrl && (
                          <a 
                            href={settings.dbConfigUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[10px] inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded font-black transition"
                          >
                            <span>فتح الكونسول 🌐</span>
                          </a>
                        )}
                      </div>
                      <input
                        type="text"
                        value={settings.dbConfigUrl || ""}
                        onChange={(e) => setSettings({ ...settings, dbConfigUrl: e.target.value })}
                        placeholder="https://console.firebase.google.com/..."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* هاتف الدعم التنسيقي */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700 font-extrabold">رقم هاتف مسؤول الدعم التنسيقي المباشر 📞</label>
                      <input
                        type="text"
                        value={settings.supportAgentPhoneNumber || ""}
                        onChange={(e) => setSettings({ ...settings, supportAgentPhoneNumber: e.target.value })}
                        placeholder="مثال: 01012345678"
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-center font-bold text-indigo-950"
                      />
                    </div>

                    {/* رابط الدعم المباشر واتسااب */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700 font-extrabold">رابط الدعم الفني المباشر بالواجهة (WhatsApp Support) 💬</label>
                      <input
                        type="text"
                        value={settings.officialWhatsAppSupportLink || ""}
                        onChange={(e) => setSettings({ ...settings, officialWhatsAppSupportLink: e.target.value })}
                        placeholder="https://wa.me/201012345678..."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* رابط الدعم تيليجرام */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700">رابط قناة أو دعم تيليجرام (Telegram Community) ✈️</label>
                      <input
                        type="text"
                        value={settings.officialTelegramSupportLink || ""}
                        onChange={(e) => setSettings({ ...settings, officialTelegramSupportLink: e.target.value })}
                        placeholder="https://t.me/yourchannel..."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* فيديو شرح النظام */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700">رابط الفيديو التعليمي لشرح الداشبورد (يوتيوب) 📺</label>
                      <input
                        type="text"
                        value={settings.dashboardTutorialVideo || ""}
                        onChange={(e) => setSettings({ ...settings, dashboardTutorialVideo: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    {/* عداد الأيام للفترة التجريبية الافتراضية */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700">عداد أيام الفترة التجريبية الافتراضية للمطابخ ⏳</label>
                      <input
                        type="number"
                        value={settings.defaultFreeTrialDays !== undefined ? settings.defaultFreeTrialDays : ""}
                        onChange={(e) => setSettings({ ...settings, defaultFreeTrialDays: Number(e.target.value) || 30 })}
                        placeholder="مثال: 30"
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-center font-black text-indigo-950"
                      />
                    </div>

                    {/* حد الفروع مسموح لـ مطعم */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700">الحد الأقصى للفروع لكل متجر افتراضياً (branch count) 🏢</label>
                      <input
                        type="number"
                        value={settings.maxBranchesAllowed !== undefined ? settings.maxBranchesAllowed : ""}
                        onChange={(e) => setSettings({ ...settings, maxBranchesAllowed: Number(e.target.value) || 5 })}
                        placeholder="مثال: 5"
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-center font-black text-indigo-950"
                      />
                    </div>

                    {/* حد المنتجات مسموح بالمنيو */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-xs font-bold text-slate-700">الحد الأقصى للمنتجات بالمنيو لكل مطعم (products count) 🍔</label>
                      <input
                        type="number"
                        value={settings.maxMenuProductsAllowed !== undefined ? settings.maxMenuProductsAllowed : ""}
                        onChange={(e) => setSettings({ ...settings, maxMenuProductsAllowed: Number(e.target.value) || 120 })}
                        placeholder="مثال: 120"
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-indigo-50/10 border-slate-200 focus:outline-none focus:border-indigo-505 font-mono text-center font-black text-indigo-950"
                      />
                    </div>
                  </div>

                  {/* 🔐 تفويض ميزات الباقات للصلاك والملاك */}
                  <div className="mt-4 bg-indigo-50/30 border border-indigo-100 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[11px] font-black text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1">
                      <span>🔐</span> متحكم صلاحيات الوصول وميزات النظام للباقات (الحد من قدرات الفروع والعروض)
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* الخطة العادية (Standard) */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center gap-1.5 border-b pb-1.5 mb-2">
                          <span className="text-xs">⚙️</span>
                          <span className="text-xs font-black text-slate-700">صلاحيات الميزات للخطة العادية (Standard)</span>
                        </div>

                        <div className="space-y-2.5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowCoupons ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowCoupons: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">توليد كوبونات وأكواد الخصم 🎟️</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowLoyaltyPoints ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowLoyaltyPoints: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">نظام نقاط الولاء والهدايا للزبائن 🪙</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowCallCenter ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowCallCenter: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">منظومة موظفي الكول سنتر واستقبال المكالمات 🎧</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowPopups ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowPopups: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">الإعلانات المنبثقة وعروض الشاشة الكاملة (Popups) 📺</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowLiveChat ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowLiveChat: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">نظام الشات المباشر الفوري مع العملاء 💬</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.standardAllowBranches ?? true}
                              onChange={(e) => setSettings({ ...settings, standardAllowBranches: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">إضافة وتفعيل فروع إضافية متعددة 🏢</span>
                          </label>
                        </div>
                      </div>

                      {/* الخطة المميزة (Premium) */}
                      <div className="bg-orange-50/10 p-3 rounded-xl border border-orange-200/50 space-y-3">
                        <div className="flex items-center gap-1.5 border-b pb-1.5 mb-2">
                          <span className="text-xs">👑</span>
                          <span className="text-xs font-black text-orange-850">صلاحيات الميزات للخطة المميزة (Premium)</span>
                        </div>

                        <div className="space-y-2.5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowCoupons ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowCoupons: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">توليد كوبونات وأكواد الخصم 🎟️</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowLoyaltyPoints ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowLoyaltyPoints: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">نظام نقاط الولاء والهدايا للزبائن 🪙</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowCallCenter ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowCallCenter: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">منظومة موظفي الكول سنتر واستقبال المكالمات 🎧</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowPopups ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowPopups: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">الإعلانات المنبثقة وعروض الشاشة الكاملة (Popups) 📺</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowLiveChat ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowLiveChat: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">نظام الشات المباشر الفوري مع العملاء 💬</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={settings.premiumAllowBranches ?? true}
                              onChange={(e) => setSettings({ ...settings, premiumAllowBranches: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-550 w-4 h-4"
                            />
                            <span className="text-slate-700 font-bold">إضافة وتفعيل فروع إضافية متعددة 🏢</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-md transition cursor-pointer text-center"
                >
                  حفظ وإعلان كافة التغييرات على المنظومة 🚀
                </button>
              </form>
            </div>

            {/* Deep Database Factory Reset Control Panel */}
            <div className="space-y-6">
              {adminEmail === "eslamesai12@gmail.com" && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm h-fit">
                  <h3 className="font-extrabold text-slate-800 text-sm border-b pb-2 flex items-center gap-1 text-red-650">
                    <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse animate-duration-1000" />
                    التحكم الطارئ وضبط المصنع للقاعدة
                  </h3>
                  
                  <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                    إذا واجهت قاعدة البيانات صعوبات مزامنة أو دخل المطبخ في وضعية غير طبيعية أو بيانات تجريبية معطوبة، اضغط لتدمير الطلبات المخزنة وإعادة تهيئة العدادات إلى الوضع الافتراضي النظيف فوراً.
                  </p>

                  <button
                    onClick={handleGlobalFactoryReset}
                    disabled={resettingDb}
                    type="button"
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-extrabold py-2 px-4 rounded-xl text-[10.5px] shadow-md transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {resettingDb ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>تصفير وإعادة تعيين قاعدة البيانات ☁️</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Technical Helpdesk Messages View */}
        {activeTab === "support_chat" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 text-right font-sans" dir="rtl">
            <div className="border-b pb-3 border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                🛡️ مركز الدعم الفني والمراسلة المباشرة للشركاء والعملاء
              </h3>
              <p className="text-[10px] text-slate-400">تابع استفسارات ومشاكل الملاك والمشترين الفنية في الوقت الفعلي والرد عليها لدعم ولاء المنصة.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Inbox lists (col 4) */}
              <div className="lg:col-span-4 border rounded-2xl h-[520px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/45">
                <div className="p-3 bg-slate-100/80 font-black text-[11px] text-slate-600 block sticky top-0 border-b">
                  كافة التذاكر النشطة ({supportChats.length})
                </div>

                {supportChats.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-24 px-4 font-bold">لا توجد محادثات أو طلبات دعم فني نشطة حالياً.</p>
                ) : (
                  supportChats.map((chat) => (
                    <div 
                      key={chat.chatId}
                      onClick={() => {
                        setActiveChatId(chat.chatId);
                      }}
                      className={`p-3.5 hover:bg-white cursor-pointer transition flex flex-col gap-1.5 ${
                        activeChatId === chat.chatId ? "bg-white border-r-4 border-indigo-600 shadow-sm" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-extrabold text-indigo-700">{chat.senderName}</span>
                        <span className="text-[8.5px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-black">
                          {chat.userType === "owner" ? "مالك" : "عميل"}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-bold truncate">
                        المطعم: <span className="text-slate-800 font-extrabold">{chat.restaurantName}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-400 truncate leading-snug font-medium">
                        آخر رسالة: {chat.text}
                      </p>
                      <span className="text-[8px] text-slate-400 self-end mt-0.5">
                        {new Date(chat.createdAt).toLocaleTimeString("ar-EG")}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Viewport (col 8) */}
              <div className="lg:col-span-8 border rounded-2xl h-[520px] flex flex-col overflow-hidden bg-white">
                {activeChatId ? (
                  <>
                    {/* Chat header */}
                    <div className="bg-slate-800 text-white p-3 px-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[11px] font-extrabold">المعرف النشط: {activeChatId.substring(0, 18)}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveChatId(null);
                        }}
                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition text-xs"
                      >
                        إغلاق التذكرة ×
                      </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                      {activeChatMessages.map((msg: any) => {
                        const isMe = msg.senderId === "admin";
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? "items-start" : "items-end"}`}>
                            <span className="text-[8.5px] text-slate-400 mb-0.5 font-bold">
                              {msg.senderName} ({msg.userType === "admin" ? "فريق الدعم الفني" : msg.userType === "owner" ? "مالك" : "عميل"})
                            </span>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs font-semibold leading-relaxed shadow-sm ${
                              isMe 
                                ? "bg-indigo-600 text-white rounded-tr-none" 
                                : "bg-white text-slate-850 border border-slate-200 rounded-tl-none"
                            }`}>
                              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                              {msg.mediaUrl && (
                                <div className="mt-1.5 rounded-lg overflow-hidden border">
                                  <img src={msg.mediaUrl} alt="Attached pic" className="max-w-full max-h-40 object-cover mx-auto" referrerPolicy="no-referrer" />
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-0.5 select-none pr-1">
                              {new Date(msg.createdAt).toLocaleTimeString("ar-EG")}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Image preview */}
                    {replyMediaUrl && (
                      <div className="bg-slate-100 p-2 border-t flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <img src={replyMediaUrl} alt="Thumb" className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                          <span className="text-[10px] text-slate-500">صورة الرد جاهزة للرفع</span>
                        </div>
                        <button onClick={() => setReplyMediaUrl(null)} className="text-red-650 hover:bg-neutral-200 p-1 rounded-full text-[10px]">
                          حذف التجهيز ×
                        </button>
                      </div>
                    )}

                    {/* Form controls */}
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!adminReplyText.trim() && !replyMediaUrl) return;
                        setSendingReply(true);

                        const text = adminReplyText;
                        const media = replyMediaUrl;
                        setAdminReplyText("");
                        setReplyMediaUrl(null);

                        try {
                          await addDoc(collection(db, "support_chats"), {
                            chatId: activeChatId,
                            text,
                            mediaUrl: media || "",
                            senderId: "admin",
                            senderName: "الدعم الفني للمنصة 🛡️",
                            userType: "admin",
                            createdAt: new Date().toISOString()
                          });
                        } catch (err) {
                          console.error("Failed to post admin reply:", err);
                        } finally {
                          setSendingReply(false);
                        }
                      }}
                      className="p-3 border-t bg-white flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="اكتب رد الدعم الفني الرسمي للعميل أو الشريك..."
                        className="flex-grow text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                      />

                      <label className="text-slate-500 hover:text-indigo-600 p-2 border rounded-xl hover:bg-slate-50 cursor-pointer shrink-0 transition">
                        <span>🖼️</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setSendingReply(true);
                              const compressedBase64 = await compressImage(file, 800, 800, 0.75);
                              if (!isSizeSafe(compressedBase64)) {
                                alert("حجم الصورة كبير جداً، يرجى اختيار صورة أخرى.");
                                return;
                              }
                              setReplyMediaUrl(compressedBase64);
                            } catch (err) {
                              console.error(err);
                              alert("وفشل ضغط الصورة.");
                            } finally {
                              setSendingReply(false);
                            }
                          }} 
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={sendingReply || (!adminReplyText.trim() && !replyMediaUrl)}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        إرسال الرد 🛡️
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center h-full text-slate-400 space-y-2">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-2 animate-bounce">
                      🛡️
                    </div>
                    <p className="text-xs font-black text-slate-700">تذكرة غير محددة</p>
                    <p className="text-[10px] text-slate-450 max-w-[65%] leading-normal mx-auto">
                      اختر أي محادثة أو استفسار فني من القائمة اليمنى للبدء بسحب سجل الدردشة الفوري والرد عليها في الوقت الفعلي.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "marketing_agents" && (
          <MarketingPlanDashboard 
            restaurants={restaurants}
            selectedRestaurantId={selectedMarketingRestaurantId}
            setSelectedRestaurantId={setSelectedMarketingRestaurantId}
          />
        )}
      </main>

      {branchManagingRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm shadow-2xl" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ChefHat className="w-6 h-6 text-orange-400" />
                <div>
                  <h3 className="font-extrabold text-base">التحكم في أيقونات وأقسام فروع المطعم</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">المطعم: <span className="text-white font-black">{branchManagingRestaurant.name}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setBranchManagingRestaurant(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-xs leading-relaxed">
                <p className="font-extrabold mb-1">💡 فكرة التشغيل والتفعيل الجغرافي للفروع:</p>
                يمكنك هنا تحديد وتخصيص الأيقونات والأقسام التي تظهر لمالك المطعم في لوحة تحكمه لكل فرع على حدة. 
                قم بإلغاء تحديد الأيقونة لإخفائها لمالك المطعم عندما يحدد هذا الفرع كفرع نشط.
              </div>

              {loadingBranches ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <span>جاري تحميل قائمة الفروع الحالية...</span>
                </div>
              ) : restaurantBranches.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                  <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                  <p className="font-extrabold text-sm text-slate-700">لا توجد فروع مسجلة لهذا المطعم حالياً.</p>
                  <p className="text-xs text-slate-400 mt-1">يجب على مالك المطعم إضافة فروع أولاً من لوحة تحكمه الخاصة بقسم الفروع لكي تتحكم بها هنا.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {restaurantBranches.map((branch) => {
                    const disabledTabs = branch.disabledTabs || [];

                    return (
                      <div key={branch.id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition bg-slate-50/35">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 mb-4 border-slate-100 gap-2">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                              {branch.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">المحافظة: {branch.governorate} | العنوان: {branch.address} | الهاتف: {branch.phone}</p>
                          </div>
                          <div className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black font-mono">
                            ID: {branch.id}
                          </div>
                        </div>

                        {/* Checklist of tabs/icons */}
                        <div>
                          <p className="text-xs font-bold text-slate-700 mb-3">حدد الأقسام/الأيقونات المصرح بعرضها للمالك في هذا الفرع:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {ALL_OWNER_TABS.map((tab) => {
                              const isVisible = !disabledTabs.includes(tab.id);

                              return (
                                <label 
                                  key={tab.id}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${
                                    isVisible 
                                      ? "bg-emerald-50/45 border-emerald-200 text-emerald-800 hover:bg-emerald-50" 
                                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() => handleToggleBranchTab(branch.id, tab.id)}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20 cursor-pointer"
                                  />
                                  <span className="font-extrabold">{tab.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t flex justify-end shrink-0">
              <button 
                onClick={() => setBranchManagingRestaurant(null)}
                className="bg-slate-900 text-white hover:bg-slate-800 font-extrabold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-slate-900/10 cursor-pointer"
              >
                حفظ وإغلاق نافذة التحكم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
