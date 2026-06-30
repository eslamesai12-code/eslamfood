import React, { useState, useEffect, useRef } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  collection, doc, getDoc, getDocs, addDoc, onSnapshot, updateDoc, query, where, setDoc, deleteDoc 
} from "firebase/firestore";
import { 
  ChefHat, ShoppingBag, MapPin, Phone, Check, ArrowRight, 
  Plus, Minus, Navigation, AlertTriangle, AlertCircle, Sparkles, Clock, Compass, X,
  Home, ShoppingCart, Receipt, User, Utensils, Star, History, AlertOctagon, MessageSquare, Facebook, Youtube, Video,
  Bell, Loader2, Instagram, Link
} from "lucide-react";
import { Restaurant, MenuItem, Order, OrderItem } from "../types";

import TechSupportChatWidget from "./TechSupportChatWidget";
import WhatsAppStatusWidget from "./WhatsAppStatusWidget";
import OrderChatComponent from "./OrderChatComponent";
import LiveDeliveryMap from "./LiveDeliveryMap";

interface CustomerRestaurantViewProps {
  storeId: string;
}

export default function CustomerRestaurantView({ storeId }: CustomerRestaurantViewProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const currencySymbol = restaurant?.currency === 'USD' ? '$' : restaurant?.currency === 'SAR' ? 'ر.س' : restaurant?.currency === 'AED' ? 'د.إ' : restaurant?.currency === 'EUR' ? '€' : 'ج.م';
  const taxPercentage = restaurant?.taxPercentage || 0;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isProfileFound, setIsProfileFound] = useState<boolean | null>(null);
  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize custom branding into localStorage and dynamically update PWA manifest/meta tags
  useEffect(() => {
    if (restaurant) {
      const appName = restaurant.customAppName || restaurant.name;
      localStorage.setItem("islamfood_active_customer_app_name", appName);
      document.title = appName;

      const appIcon = restaurant.customAppIcon || restaurant.image || "/app_logo.jpg";
      localStorage.setItem("islamfood_active_customer_app_icon", appIcon);

      // Dynamically update or append the manifest tag
      let manifestTag = document.getElementById("pwa-manifest") as HTMLLinkElement | null;
      if (!manifestTag) {
        manifestTag = document.querySelector("link[rel='manifest']");
      }
      if (manifestTag) {
        manifestTag.id = "pwa-manifest";
        manifestTag.href = `/api/manifest.json?restaurantId=${restaurant.id}`;
      } else {
        const link = document.createElement("link");
        link.id = "pwa-manifest";
        link.rel = "manifest";
        link.href = `/api/manifest.json?restaurantId=${restaurant.id}`;
        document.head.appendChild(link);
      }

      // Dynamically update standard icon and apple-touch-icon
      const iconTag = document.querySelector("link[rel='icon']");
      if (iconTag) iconTag.setAttribute("href", appIcon);

      const appleTag = document.querySelector("link[rel='apple-touch-icon']");
      if (appleTag) appleTag.setAttribute("href", appIcon);
    }
  }, [restaurant]);

  // Mobile layout active tab state
  const [activeTab, setActiveTab] = useState<"home" | "cart" | "orders" | "profile">("home");
  const [bannerIndex, setBannerIndex] = useState(0);

  // Shopping Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedOrderType, setSelectedOrderType] = useState<"delivery" | "dine_in" | "pickup">("delivery");

  // New E-commerce Form States
  const [customerAge, setCustomerAge] = useState("");
  const [customerGovernorate, setCustomerGovernorate] = useState("القاهرة");
  const [customerStreet, setCustomerStreet] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'visa' | 'cash' | 'instapay' | 'vodafone_cash'>('cash');
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);

  // AI Support chatbot state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'مرحباً بك! أنا مساعد الذكاء الاصطناعي لخدمة عملاء المطعم، كيف يمكنني مساعدتك وسماع طلبك اللذيذ اليوم؟ يمكنك الاستفسار عن المنيو، الفروع المتوفرة، أو تتبع طلبك النشط!' }
  ]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get("table") || params.get("tableNumber");
      if (tableParam) {
        setTableNumber(tableParam);
        setSelectedOrderType("dine_in");
      }
    } catch (err) {
      console.error("Error reading table query parameter:", err);
    }
  }, []);

  // Theme & Language Settings for Customer View
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem("islamfood_theme_mode");
      return (saved === 'dark') ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [appLanguage, setAppLanguage] = useState<'ar' | 'en'>(() => {
    try {
      const saved = localStorage.getItem("islamfood_language");
      return (saved === 'en') ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  // Full Screen Advertisement POPUP States
  const [activeAdvertisement, setActiveAdvertisement] = useState<any | null>(null);
  const [showAdPopup, setShowAdPopup] = useState(false);
  const [adZoomScale, setAdZoomScale] = useState<number>(1.0);
  const [adFitMode, setAdFitMode] = useState<"cover" | "contain">("contain");
  const [adReplyText, setAdReplyText] = useState("");
  const [isSendingAdReply, setIsSendingAdReply] = useState(false);

  // Item Specs & Customization Dialog Modal States
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItem | null>(null);
  const [itemModalNotes, setItemModalNotes] = useState("");
  const [itemModalQuantity, setItemModalQuantity] = useState(1);
  const [itemModalSelectedOptions, setItemModalSelectedOptions] = useState<{ name: string; price: number }[]>([]);

  const translations = {
    ar: {
      profileTitle: "حسابي الشخصي",
      changeProfile: "تحديث الملف الشخصي",
      fullName: "الاسم بالكامل",
      fullAddress: "العنوان والشارع بالكامل",
      phone: "رقم الهاتف",
      age: "العمر / السن",
      saveChanges: "حفظ التغييرات",
      loyaltyTitle: "بطاقة ولاء عملاء إسلام فود 👑",
      totalPoints: "مجموع نقاطك",
      remainingPoints: "باقي ترقية النقاط",
      pointsValue: "قيمة النقطة",
      pointsPlaceholder: "برجاء كتابة رقم الهاتف بالأسفل",
      languageLabel: "لغة التطبيق / App Language",
      themeLabel: "مظهر وألوان التطبيق / Theme Mode",
      themeLight: "الوضع الفاتح ☀️ Light Mode",
      themeDark: "الوضع الداكن 🌙 Dark Mode",
      arabicBtn: "العربية 🇪🇬",
      englishBtn: "English 🇬🇧",
      cartTitle: "سلة المشتريات",
      backMenu: "العودة للقائمة الرئيسية",
      emptyCart: "سلة مشترياتك فارغة حالياً 🥞",
      checkoutBtn: "تأكيد وإتمام الطلب 🚀",
      totalPrice: "إجمالي الحساب الكلي",
    },
    en: {
      profileTitle: "My Personal Profile",
      changeProfile: "Update Profile Details",
      fullName: "Full Name",
      fullAddress: "Full Delivery Address",
      phone: "Phone Number",
      age: "Age",
      saveChanges: "Save Changes",
      loyaltyTitle: "Loyalty Customer Card 👑",
      totalPoints: "Your Total Points",
      remainingPoints: "Points remaining for upgrade",
      pointsValue: "Point Value",
      pointsPlaceholder: "Please enter phone number below",
      languageLabel: "Language Selector",
      themeLabel: "Theme Customizer",
      themeLight: "☀️ Light Mode",
      themeDark: "🌙 Dark Mode",
      arabicBtn: "العربية",
      englishBtn: "English",
      cartTitle: "Shopping Cart",
      backMenu: "Back to Main Menu",
      emptyCart: "Your shopping cart is currently empty 🥞",
      checkoutBtn: "Confirm and Check Out Order 🚀",
      totalPrice: "Grand Total Balance",
    }
  };

  const t = translations[appLanguage] || translations.ar;

  const getTerm = (key: 'store' | 'items' | 'dinein' | 'dinein_explain' | 'menu' | 'cart_empty' | 'add_to_cart' | 'categories') => {
    const type = restaurant?.businessType || 'restaurant';
    const isAr = appLanguage === 'ar';

    if (type === 'supermarket') {
      switch (key) {
        case 'store': return isAr ? 'السوبر ماركت' : 'Supermarket';
        case 'items': return isAr ? 'المنتجات' : 'Products';
        case 'dinein': return isAr ? 'شراء فوري بالفرع 🛒' : 'In-store Pickup 🛒';
        case 'dinein_explain': return isAr ? 'تجهيز الطلب لاستلامه من الرفوف بالفرع' : 'Prepare items for immediate pick up in branch';
        case 'menu': return isAr ? 'قائمة المنتجات والسلع' : 'Product Catalog';
        case 'cart_empty': return isAr ? 'سلة المشتريات فارغة حالياً 🛒' : 'Your cart is empty 🛒';
        case 'add_to_cart': return isAr ? 'إضافة للسلة 🛒' : 'Add to Cart 🛒';
        case 'categories': return isAr ? 'أقسام المنتجات' : 'Store Sections';
        default: return '';
      }
    } else if (type === 'clothing') {
      switch (key) {
        case 'store': return isAr ? 'محل الملابس' : 'Clothing Store';
        case 'items': return isAr ? 'الأزياء والمعروضات' : 'Fashion Items';
        case 'dinein': return isAr ? 'معاينة واستلام بالبوتيك 👕' : 'Boutique Pickup 👕';
        case 'dinein_explain': return isAr ? 'تجهيز الملابس للمعاينة وتجربة القياس بالفرع' : 'Reserve items for try-on or pickup in boutique';
        case 'menu': return isAr ? 'كتالوج الملابس والأزياء' : 'Apparel Catalog';
        case 'cart_empty': return isAr ? 'سلة التسوق فارغة حالياً 👕' : 'Your shopping bag is empty 👕';
        case 'add_to_cart': return isAr ? 'إضافة لحقيبة التسوق 🛍️' : 'Add to Bag 🛍️';
        case 'categories': return isAr ? 'أقسام الأزياء' : 'Fashion Categories';
        default: return '';
      }
    } else if (type === 'accessories') {
      switch (key) {
        case 'store': return isAr ? 'معرض الإكسسوارات' : 'Accessories Store';
        case 'items': return isAr ? 'المعروضات والهدايا' : 'Accessories';
        case 'dinein': return isAr ? 'معاينة واستلام بالمعرض 👜' : 'Showroom Pickup 👜';
        case 'dinein_explain': return isAr ? 'تجهيز الإكسسوارات للمعاينة بالمعرض' : 'Prepare items for showroom viewing & pickup';
        case 'menu': return isAr ? 'تشكيلة الإكسسوارات والهدايا' : 'Gift & Accessories Collection';
        case 'cart_empty': return isAr ? 'حقيبة الهدايا فارغة حالياً 👜' : 'Your gift bag is empty 👜';
        case 'add_to_cart': return isAr ? 'شراء وإضافة للحقيبة 🎁' : 'Add to Box 🎁';
        case 'categories': return isAr ? 'أقسام المعروضات' : 'Collection Categories';
        default: return '';
      }
    } else {
      // Default restaurant / other
      switch (key) {
        case 'store': return isAr ? 'المطعم' : 'Restaurant';
        case 'items': return isAr ? 'الوجبات' : 'Meals';
        case 'dinein': return isAr ? 'تناول بالصالة 🍽️' : 'Dine-In 🍽️';
        case 'dinein_explain': return isAr ? 'طلب وحجز طاولة لتناول الوجبات بالصالة' : 'Order and reserve a table to dine inside';
        case 'menu': return isAr ? 'قائمة المأكولات والشراب' : 'Food & Drink Menu';
        case 'cart_empty': return isAr ? 'سلة مشترياتك فارغة حالياً 🥞' : 'Your shopping cart is currently empty 🥞';
        case 'add_to_cart': return isAr ? 'إضافة للطلب' : 'Add to Order';
        case 'categories': return isAr ? 'أقسام المنيو' : 'Menu Sections';
        default: return '';
      }
    }
  };

  // Real store ID and loyalty program states
  const [realStoreId, setRealStoreId] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltyAppliedDiscount, setLoyaltyAppliedDiscount] = useState(0);

  // Geolocation Boundary Control State
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isInsideZone, setIsInsideZone] = useState<boolean | null>(null);
  const [bypassLocationCheck, setBypassLocationCheck] = useState(false);

  // Nearest Branch & Out of Zone States
  const [isOutOfZone, setIsOutOfZone] = useState<boolean | null>(null);
  const [nearestBranch, setNearestBranch] = useState<any>(null);
  const [nearestBranchDistanceKm, setNearestBranchDistanceKm] = useState<number | null>(null);

  // Active Submitted Order Tracking State
  const [selectedTrackOrderId, setSelectedTrackOrderId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [secondsTick, setSecondsTick] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (selectedTrackOrderId && trackedOrder?.status === "pending") {
      interval = setInterval(() => {
        setSecondsTick((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTrackOrderId, trackedOrder?.status]);

  // Browser Web Notification Permission and Tracking State
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const prevTrackedStatus = useRef<string | null>(null);

  const requestNotificationPermissions = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
        if (permission === "granted") {
          try {
            new Notification("رائع! تم تفعيل الإشعارات 🔔", {
              body: "سنقوم بإرسال تنبيه مباشر إلى هاتفكم بمجرد تغيير حالة وجبتكم اللذيذة بالمطبخ.",
              icon: restaurant?.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&auto=format&fit=crop"
            });
          } catch (err) {
            console.warn("Notification error:", err);
          }
        }
      });
    } else {
      alert("عذراً، متصفحك أو هاتفك لا يدعم ميزة الإشعارات المباشرة.");
    }
  };

  // Order history
  const [historyOrderIds, setHistoryOrderIds] = useState<string[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);

  // Custom Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<string | null>(null);
  const [customerCancelReason, setCustomerCancelReason] = useState("");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  // Coupon Verification States
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // Modern Toast system local states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Helper to trigger elegant non-blocking toast popups
  const showToastMessage = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Toast auto dismissal logic
  useEffect(() => {
    if (!toast) return;
    const hideTimeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(hideTimeout);
  }, [toast]);

  // Customer Order Rating & Review States
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Selected Category State
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  const getRestaurantOpenStatus = () => {
    if (!restaurant) return null;

    if (restaurant.isClosedManual) {
      let manualMsg = "نعتذر، المطعم خارج الخدمة مؤقتاً حالياً 🛑";
      if (restaurant.closeReason === "temporarily_closed") {
        manualMsg = "المطعم خارج الخدمة مؤقتاً 🛑";
      } else if (restaurant.closeReason === "busy") {
        manualMsg = "المطعم مزدحم جداً حالياً ونحتفظ بكامل الدقة لتلبية طلبات الجودة ⏳";
      } else if (restaurant.closeReason === "no_delivery_drivers") {
        manualMsg = "نعتذر، لا يتوفر مندوب توصيل في الوقت الحالي 🛵❌";
      }
      if (restaurant.closeCustomMessage) {
        manualMsg = restaurant.closeCustomMessage;
      }
      return {
        isOpenNow: false,
        isManual: true,
        scheduleMsg: manualMsg,
        todayHours: null,
        dayAr: ""
      };
    }

    const workingHours = restaurant.workingHours;
    if (!workingHours) return { isOpenNow: true, scheduleMsg: "مفتوح على مدار الساعة" };

    const daysEnToAr: Record<string, string> = {
      saturday: "السبت",
      sunday: "الأحد",
      monday: "الإثنين",
      tuesday: "الثلاثاء",
      wednesday: "الأربعاء",
      thursday: "الخميس",
      friday: "الجمعة"
    };

    const now = new Date();
    const englishDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayEn = englishDays[now.getDay()];
    
    const todaySchedule = workingHours[currentDayEn];
    if (!todaySchedule) {
      return { isOpenNow: true, scheduleMsg: "مفتوح حالياً" };
    }

    if (!todaySchedule.isOpen) {
      return { 
        isOpenNow: false, 
        scheduleMsg: `مغلق اليوم (${daysEnToAr[currentDayEn]}) طوال اليوم`, 
        todayHours: null,
        dayAr: daysEnToAr[currentDayEn]
      };
    }

    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    const parseToFloat = (tStr: string) => {
      if (!tStr) return 0;
      const [hStr, mStr] = tStr.split(":");
      return parseInt(hStr, 10) + parseInt(mStr || "0", 10) / 60;
    };

    const openVal = parseToFloat(todaySchedule.openTime);
    const closeVal = parseToFloat(todaySchedule.closeTime);

    let isOpenNow = false;
    if (closeVal < openVal) {
      isOpenNow = (currentHour >= openVal || currentHour <= closeVal);
    } else {
      isOpenNow = (currentHour >= openVal && currentHour <= closeVal);
    }

    const formatTimeAr = (timeStr: string) => {
      if (!timeStr) return "";
      const [hStr, mStr] = timeStr.split(":");
      let hrs = parseInt(hStr, 10);
      const suffix = hrs >= 12 ? "م" : "ص";
      hrs = hrs % 12;
      if (hrs === 0) hrs = 12;
      return `${hrs}:${mStr || "00"} ${suffix}`;
    };

    return {
      isOpenNow,
      scheduleMsg: isOpenNow 
        ? `مفتوح اليوم حتى ${formatTimeAr(todaySchedule.closeTime)}` 
        : `مغلق الآن • العمل من ${formatTimeAr(todaySchedule.openTime)} إلى ${formatTimeAr(todaySchedule.closeTime)}`,
      todayHours: todaySchedule,
      dayAr: daysEnToAr[currentDayEn]
    };
  };

  // Banner Slideshow Auto-rotation timer hook
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    const sRef = doc(db, "admin_settings", "global");
    const unsub = onSnapshot(sRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalSettings(data);
        if (data.menuAdZoomScale !== undefined) {
          setAdZoomScale(Number(data.menuAdZoomScale));
        }
        if (data.menuAdFitMode !== undefined) {
          setAdFitMode(data.menuAdFitMode);
        }
      }
    }, (err) => {
      console.warn("Failed to subscribe to global admin settings in Customer View:", err);
    });
    return unsub;
  }, []);

  // Real-time Heartbeat & Visit Log tracker
  useEffect(() => {
    if (!realStoreId) return;

    // A. Generate unique session ID to track online counts correctly
    let sessionId = sessionStorage.getItem("islamfood_session_id");
    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem("islamfood_session_id", sessionId);
    }

    // B. Register the Link Visit Log once per browser session
    const visitLoggedKey = `islamfood_visit_logged_${realStoreId}`;
    if (!sessionStorage.getItem(visitLoggedKey)) {
      sessionStorage.setItem(visitLoggedKey, "true");
      
      const logVisit = async () => {
        try {
          await addDoc(collection(db, "restaurants", realStoreId, "activity_logs"), {
            type: "visit",
            userRole: "customer",
            description: "فتح رابط تصفح المنيو وأكلات المطعم (عميل)",
            userAgent: navigator.userAgent.substring(0, 120),
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to write link visit log:", err);
        }
      };
      logVisit();
    }

    // C. Write first heartbeat and start the periodic trigger (every 30 seconds)
    const heartbeatRef = doc(db, "restaurants", realStoreId, "online_clients", sessionId);
    const writeHeartbeat = async () => {
      try {
        await setDoc(heartbeatRef, {
          id: sessionId,
          role: "customer",
          lastActive: Date.now(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to update status heartbeat:", err);
      }
    };

    writeHeartbeat();
    const intervalId = setInterval(writeHeartbeat, 30000);

    // D. Clean up heartbeat document on unmount/tab close to instantly keep active user counts correct
    return () => {
      clearInterval(intervalId);
      deleteDoc(heartbeatRef).catch(() => {});
    };
  }, [realStoreId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 1. Resolve Friendly Store Identifier
  useEffect(() => {
    async function resolveStoreId() {
      setLoading(true);
      setError(null);
      try {
        // A. Check if storeId is direct document ID
        const directDocRef = doc(db, "restaurants", storeId);
        const directSnap = await getDoc(directDocRef);
        if (directSnap.exists()) {
          setRealStoreId(storeId);
          setIsProfileFound(true);
          return;
        }

        // B. Query restaurants collection for matching custom slug
        const q = query(collection(db, "restaurants"), where("slug", "==", storeId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const matchedDoc = qSnap.docs[0];
          setRealStoreId(matchedDoc.id);
          setIsProfileFound(true);
          return;
        }

        // C. Match lowercase slug
        const lowerSlug = storeId.toLowerCase();
        const qLower = query(collection(db, "restaurants"), where("slug", "==", lowerSlug));
        const qLowerSnap = await getDocs(qLower);
        if (!qLowerSnap.empty) {
          const matchedDoc = qLowerSnap.docs[0];
          setRealStoreId(matchedDoc.id);
          setIsProfileFound(true);
          return;
        }

        // D. Fallback Match by Decoded Name
        const decodedName = decodeURIComponent(storeId);
        const qName = query(collection(db, "restaurants"), where("name", "==", decodedName));
        const qNameSnap = await getDocs(qName);
        if (!qNameSnap.empty) {
          const matchedDoc = qNameSnap.docs[0];
          setRealStoreId(matchedDoc.id);
          setIsProfileFound(true);
          return;
        }

        // E. Fallback fully to direct storeId
        setRealStoreId(storeId);
      } catch (err) {
        console.error("Error resolving friendly store ID:", err);
        setRealStoreId(storeId);
      }
    }

    resolveStoreId();
  }, [storeId]);

  // 2. Load Store Details & Menu based on resolved realStoreId
  useEffect(() => {
    if (!realStoreId) return;

    setLoading(true);
    setError(null);

    const storeRef = doc(db, "restaurants", realStoreId);
    const menuColRef = collection(db, "restaurants", realStoreId, "menu_items");
    const branchesColRef = collection(db, "restaurants", realStoreId, "branches");

    // A. Subscribe to Store Details
    const unsubStore = onSnapshot(
      storeRef,
      (snapshot) => {
        setLoading(false);
        if (!snapshot.exists()) {
          setIsProfileFound(false);
          console.log("Restaurant profile not found in database. Initializing beautiful fallback state.");
          const trialEnds = new Date();
          trialEnds.setDate(trialEnds.getDate() + 30);
          const demoRes: Restaurant = {
            id: realStoreId,
            ownerId: realStoreId,
            ownerEmail: "eslamesai12@gmail.com",
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
            deliveryFee: 15,
            dineInFee: 10,
            pickupFee: 0,
            workingHours: {
              saturday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              sunday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              monday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              tuesday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              wednesday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              thursday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
              friday: { isOpen: true, openTime: "09:00", closeTime: "23:00" }
            }
          };
          setRestaurant(demoRes);
          return;
        }
        setIsProfileFound(true);
        const storeData = snapshot.data() as Restaurant;
        setRestaurant(storeData);
      },
      (err) => {
        console.error("Error subscribing to store profile:", err);
        setLoading(false);
        setIsProfileFound(false);
        // Fallback to high-quality demo restaurant state if read fails (e.g. database offline/permission issues)
        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 30);
        const demoRes: Restaurant = {
          id: realStoreId,
          ownerId: realStoreId,
          ownerEmail: "eslamesai12@gmail.com",
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
          deliveryFee: 15,
          dineInFee: 10,
          pickupFee: 0,
          workingHours: {
            saturday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            sunday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            monday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            tuesday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            wednesday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            thursday: { isOpen: true, openTime: "09:00", closeTime: "23:00" },
            friday: { isOpen: true, openTime: "09:00", closeTime: "23:00" }
          }
        };
        setRestaurant(demoRes);
        handleFirestoreError(err, OperationType.GET, `restaurants/${realStoreId}`);
      }
    );

    // B. Subscribe to Menu Items
    const unsubMenu = onSnapshot(
      menuColRef,
      (snapshot) => {
        const mList: MenuItem[] = [];
        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as MenuItem;
          if (item.isAvailable !== false) {
            mList.push({ ...item, id: docSnap.id });
          }
        });
        setDbMenuItems(mList);
      },
      (err) => {
        console.error("Error subscribing to menu items:", err);
        setDbMenuItems([]);
        handleFirestoreError(err, OperationType.GET, `restaurants/${realStoreId}/menu_items`);
      }
    );

    // C. Subscribe to Branches
    const unsubBranches = onSnapshot(
      branchesColRef,
      (snapshot) => {
        const bList: any[] = [];
        snapshot.forEach((docSnap) => {
          bList.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        if (bList.length === 0) {
          const mainBranch = [
            { id: "main", name: "الفرع الرئيسي", address: restaurant?.address || "الموقع الرئيسي" }
          ];
          setBranches(mainBranch);
          setSelectedBranchId("main");
        } else {
          setBranches(bList);
          if (bList.length > 0) {
            setSelectedBranchId((prev) => prev || bList[0].id);
          }
        }
      },
      (err) => {
        console.error("Error subscribing to branches:", err);
        const mainBranch = [
          { id: "main", name: "الفرع الرئيسي", address: restaurant?.address || "الموقع الرئيسي" }
        ];
        setBranches(mainBranch);
        setSelectedBranchId("main");
        handleFirestoreError(err, OperationType.GET, `restaurants/${realStoreId}/branches`);
      }
    );

    // D. Subscribe to announcements / advertisement popups
    const adsColRef = collection(db, "announcements_ads");
    const qAds = query(adsColRef, where("restaurantId", "==", realStoreId));
    const unsubAds = onSnapshot(
      qAds,
      (snapshot) => {
        const adsList: any[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.active === true) {
            adsList.push({ id: docSnap.id, ...d });
          }
        });
        
        if (adsList.length > 0) {
          adsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const latestAd = adsList[0];
          
          const alreadySkipped = sessionStorage.getItem("islamfood_ad_skipped_" + latestAd.id);
          if (!alreadySkipped) {
            setActiveAdvertisement(latestAd);
            setShowAdPopup(true);
          }
        } else {
          setActiveAdvertisement(null);
          setShowAdPopup(false);
        }
      },
      (err) => {
        console.error("Error subscribing to ads:", err);
      }
    );

    return () => {
      unsubStore();
      unsubMenu();
      unsubBranches();
      unsubAds();
    };
  }, [realStoreId]);

  useEffect(() => {
    if (showAdPopup && activeAdvertisement?.id) {
      const adId = activeAdvertisement.id;
      const docRef = doc(db, "announcements_ads", adId);
      updateDoc(docRef, {
        viewsCount: (activeAdvertisement.viewsCount || 0) + 1
      }).catch(err => console.error("Error updating ad viewsCount:", err));
    }
  }, [showAdPopup, activeAdvertisement?.id]);

  const handleSendAdReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adReplyText.trim() || !activeAdvertisement?.id) return;

    setIsSendingAdReply(true);
    try {
      const actualStoreId = realStoreId || storeId;
      await addDoc(collection(db, "ad_story_replies"), {
        type: "ad",
        itemId: activeAdvertisement.id,
        itemMedia: activeAdvertisement.mediaUrl || "",
        itemText: activeAdvertisement.text || "إعلان ممول",
        restaurantId: actualStoreId,
        customerName: customerName || "عميل زائر",
        customerPhone: customerPhone || "",
        replyText: adReplyText.trim(),
        createdAt: new Date().toISOString()
      });
      setAdReplyText("");
      alert("تم إرسال ردك على الإعلان بنجاح إلى صاحب المطعم! 💬🎉");
    } catch (err) {
      console.error("Error sending ad reply:", err);
      alert("فشل في إرسال الرد. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSendingAdReply(false);
    }
  };

  // Keep single main branch address updated with real restaurant address once fetched
  useEffect(() => {
    if (branches.length === 1 && branches[0].id === "main" && restaurant?.address) {
      setBranches([{ id: "main", name: "الفرع الرئيسي", address: restaurant.address }]);
    }
  }, [restaurant?.address]);

  // Reactively sync menu items when store details and items snapshots are loaded
  useEffect(() => {
    if (dbMenuItems !== null) {
      setMenuItems(dbMenuItems);
    }
  }, [dbMenuItems]);

  // Keep customer selected options in sync with restaurant toggle configurations
  useEffect(() => {
    if (restaurant) {
      if (restaurant.allowDelivery !== false && !globalSettings?.deliveryServicesSuspended) {
        setSelectedOrderType("delivery");
      } else if (restaurant.allowDineIn !== false) {
        setSelectedOrderType("dine_in");
      } else if (restaurant.allowPickup !== false) {
        setSelectedOrderType("pickup");
      }
    }
  }, [restaurant, globalSettings]);

  useEffect(() => {
    if (restaurant) {
      if (restaurant.allowCash !== false) {
        setSelectedPaymentMethod("cash");
      } else if (restaurant.allowVisa !== false) {
        setSelectedPaymentMethod("visa");
      } else if (restaurant.allowInstapay !== false) {
        setSelectedPaymentMethod("instapay");
      } else if (restaurant.allowVodafoneCash !== false) {
        setSelectedPaymentMethod("vodafone_cash");
      }
    }
  }, [restaurant]);

  // Load saved user state and active orders from localStorage
  useEffect(() => {
    const savedOrderId = localStorage.getItem(`active_order_${storeId}`);
    if (savedOrderId) {
      setActiveOrderId(savedOrderId);
      setSelectedTrackOrderId(savedOrderId);
    }
    
    // Load historical order IDs
    const historyKey = `customer_order_history_${storeId}`;
    const savedHistory = localStorage.getItem(historyKey);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory) as string[];
        if (Array.isArray(parsed)) {
          setHistoryOrderIds(parsed);
          if (!savedOrderId && parsed.length > 0) {
            setSelectedTrackOrderId(parsed[0]);
          }
        }
      } catch (e) {
        console.error("Failed to parse historical orders", e);
      }
    }
    
    const savedProfile = localStorage.getItem("user_profile");
    if (savedProfile) {
      try {
        const prof = JSON.parse(savedProfile);
        if (prof.name) setCustomerName(prof.name);
        if (prof.phone) setCustomerPhone(prof.phone);
        if (prof.age) setCustomerAge(prof.age);
        if (prof.governorate) setCustomerGovernorate(prof.governorate);
        if (prof.street) setCustomerStreet(prof.street);
        if (prof.address) setDeliveryAddress(prof.address);
      } catch (e) {
        console.error("Failed to parse user profile from cache", e);
      }
    }
  }, [storeId]);

  // Save active order to localStorage helper
  const saveActiveOrder = (orderId: string | null) => {
    setActiveOrderId(orderId);
    setSelectedTrackOrderId(orderId);
    if (orderId) {
      localStorage.setItem(`active_order_${storeId}`, orderId);
      
      const historyKey = `customer_order_history_${storeId}`;
      let list: string[] = [];
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        try {
          list = JSON.parse(savedHistory);
        } catch (e) {
          list = [];
        }
      }
      if (!list.includes(orderId)) {
        const updated = [orderId, ...list];
        localStorage.setItem(historyKey, JSON.stringify(updated));
        setHistoryOrderIds(updated);
      }
    } else {
      localStorage.removeItem(`active_order_${storeId}`);
    }
  };

  // Synchronize all historical orders
  useEffect(() => {
    if (historyOrderIds.length === 0) {
      setHistoryOrders([]);
      return;
    }

    const unsubscribes = historyOrderIds.map((id) => {
      return onSnapshot(
        doc(db, "orders", id),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = { ...docSnap.data(), id: docSnap.id } as Order;
            setHistoryOrders((prev) => {
              const filtered = prev.filter((o) => o.id !== id);
              return [...filtered, data].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          }
        },
        (error) => {
          console.warn(`Failed to listen to order ${id}`, error);
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [historyOrderIds]);

  // Real-time track selected order
  useEffect(() => {
    setSelectedRating(0);
    setHoveredRating(0);
    setRatingComment("");
    prevTrackedStatus.current = null;

    if (!selectedTrackOrderId) {
      setTrackedOrder(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "orders", selectedTrackOrderId), (docSnap) => {
      if (docSnap.exists()) {
        const ord = { ...docSnap.data(), id: docSnap.id } as Order;
        setTrackedOrder(ord);

        // Notify client if status has changed
        if (prevTrackedStatus.current && prevTrackedStatus.current !== ord.status) {
          let msgBody = `تحديث الطلب رقم #${ord.id.slice(-5).toUpperCase()}`;
          if (ord.status === "preparing") msgBody = "بدأ تحضير وجبتك اللذيذة بالمطبخ الآن! 🍳🔥";
          else if (ord.status === "ready") msgBody = "طلبك جاهز للتسليم والاستلام! بالهناء والشفاء 🎉🍔";
          else if (ord.status === "completed") msgBody = "تم تسليم الطلب وإكماله بنجاح! شكراً لتعاملك معنا. ❤️";
          else if (ord.status === "cancelled") msgBody = "نأسف، تم إلغاء طلبك من قبل منفذ الخدمة 😞❌";

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("تحديث حالة الطلب 🔔", {
                body: msgBody,
                icon: restaurant?.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&auto=format&fit=crop"
              });
            } catch (e) {
              console.error("Failed to trigger native notification:", e);
            }
          }
        }
        prevTrackedStatus.current = ord.status;

        if (ord.rating) {
          setSelectedRating(ord.rating);
        }
        if (ord.reviewComment) {
          setRatingComment(ord.reviewComment);
        }
      }
    });
    return () => unsub();
  }, [selectedTrackOrderId, restaurant]);

  // Handle rating and comment submission
  const handleRatingSubmit = async () => {
    if (!selectedTrackOrderId || !trackedOrder) return;
    if (selectedRating === 0) {
      showToastMessage("يرجى اختيار عدد النجوم لتقييم الوجبة والخدمة.", "error");
      return;
    }
    setSubmittingRating(true);
    try {
      const orderRef = doc(db, "orders", selectedTrackOrderId);
      await updateDoc(orderRef, {
        rating: selectedRating,
        reviewComment: ratingComment,
        ratedAt: new Date().toISOString()
      });

      // Also double-post to central app reviews for the system owner statistics
      try {
        await addDoc(collection(db, "app_reviews"), {
          rating: selectedRating,
          comment: ratingComment,
          createdAt: new Date().toISOString(),
          userName: customerName || trackedOrder.customerName || "زبون مجهول",
          userEmail: trackedOrder.customerPhone || "لا يوجد هاتف",
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          type: "customer",
          orderId: selectedTrackOrderId
        });
      } catch (errReview) {
        console.warn("Failed recording review in app_reviews:", errReview);
      }

      showToastMessage("شكراً جزيلاً لتقييمك! آرائك تساعدنا وتساعد المطبخ في تحسين الخدمة دائماً. ❤️", "success");
    } catch (err) {
      console.error("Failed to submit rating:", err);
      showToastMessage("عذراً، فشل إرسال التقييم بسبب مشكلة في الشبكة. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Handle customer canceling their order
  const handleCustomerCancelOrder = async () => {
    if (!cancelTargetOrderId) return;
    if (!customerCancelReason.trim()) {
      showToastMessage("يرجى كتابة سبب الإلغاء بوضوح.", "error");
      return;
    }
    setIsCancellingOrder(true);
    try {
      const orderRef = doc(db, "orders", cancelTargetOrderId);
      await updateDoc(orderRef, {
        status: "cancelled",
        cancelReason: customerCancelReason.trim(),
        cancelledBy: "customer"
      });
      showToastMessage("تم إلغاء الطلب بنجاح وتوثيق سبب الإلغاء.", "success");
      setIsCancelModalOpen(false);
      setCancelTargetOrderId(null);
      setCustomerCancelReason("");
    } catch (err) {
      console.error(err);
      showToastMessage("عذراً، فشل إلغاء الطلب. يرجى المحاولة لاحقاً.", "error");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Haversine Distance Calculator (Sphere Trigonometry)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // In meters
  };

  // Perform Geolocation Verification
  const verifyLocation = () => {
    if (!restaurant) return;
    
    setCheckingLocation(true);
    setLocationError(null);
    setDistanceMeters(null);
    setIsInsideZone(null);

    // Prompt location standard API
    if (!navigator.geolocation) {
      setLocationError("متصفحك لا يدعم نظام الجي بي إس لإجراء التحقق المحيطي.");
      setCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const cLat = position.coords.latitude;
        const cLng = position.coords.longitude;
        setCustomerCoords({ lat: cLat, lng: cLng });

        // Calculate distance to main branch
        const distToMain = calculateDistance(cLat, cLng, restaurant.lat, restaurant.lng);
        setDistanceMeters(Math.round(distToMain));

        // Find nearest branch based on GPS proximity
        let shortestDist = distToMain;
        let chosenBranch = { id: "main", name: "الفرع الرئيسي", address: restaurant.address };

        branches.forEach((b) => {
          const bLat = b.lat ?? restaurant.lat;
          const bLng = b.lng ?? restaurant.lng;
          const bDist = calculateDistance(cLat, cLng, bLat, bLng);
          if (bDist < shortestDist) {
            shortestDist = bDist;
            chosenBranch = b;
          }
        });

        const nearestDistKm = shortestDist / 1000;
        setNearestBranch(chosenBranch);
        setNearestBranchDistanceKm(nearestDistKm);

        // Delivery radius
        const dRadius = restaurant.deliveryRadius || 10;
        const outZone = nearestDistKm > dRadius;
        setIsOutOfZone(outZone);

        // Let's set boundary limit to 150 meters for Dine-in!
        const inside = distToMain <= 150;
        setIsInsideZone(inside);
        setCheckingLocation(false);
      },
      (error) => {
        console.error("Geolocation Error", error);
        setLocationError("تم رفض أو تعذر التقاط إذن تحديد الموقع الجغرافي بالـ GPS.");
        setCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Trigger verify on choosing Dine-in or Delivery
  useEffect(() => {
    if ((selectedOrderType === "dine_in" || selectedOrderType === "delivery") && restaurant) {
      verifyLocation();
    }
  }, [selectedOrderType, restaurant]);

  // Cart operations
  const addToCart = (
    item: MenuItem, 
    customOptions?: { name: string; price: number }[], 
    customNotes?: string, 
    qty = 1
  ) => {
    const optionNames = (customOptions || []).map(o => o.name).sort().join(",");
    const cartItemId = (customOptions && customOptions.length > 0) || customNotes 
      ? `${item.id}-${optionNames}-${customNotes || ""}` 
      : item.id;

    const optionsPrice = (customOptions || []).reduce((sum, o) => sum + o.price, 0);
    const finalPrice = item.price + optionsPrice;

    const existing = cart.find((i) => i.id === cartItemId);
    if (existing) {
      setCart(cart.map((i) => i.id === cartItemId ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      const displayOptions = (customOptions || []).map(o => o.name).join(" + ");
      const displayName = displayOptions ? `${item.name} (${displayOptions})` : item.name;

      setCart([...cart, { 
        id: cartItemId, 
        name: displayName, 
        price: finalPrice, 
        quantity: qty,
        notes: customNotes || undefined,
        selectedOptions: customOptions || undefined
      }]);
    }
  };

  const decreaseQuantity = (id: string) => {
    const existing = cart.find((i) => i.id === id);
    if (existing && existing.quantity > 1) {
      setCart(cart.map((i) => i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setCart(cart.filter((i) => i.id !== id));
    }
  };

  const getSubtotal = () => {
    return cart.reduce((total, i) => total + i.price * i.quantity, 0);
  };

  const getDeliveryFee = () => restaurant?.deliveryFee ?? 0;
  const getDineInFee = () => restaurant?.dineInFee ?? 0;
  const getPickupFee = () => restaurant?.pickupFee ?? 0;

  const getActiveFee = () => {
    if (selectedOrderType === "delivery") return getDeliveryFee();
    if (selectedOrderType === "dine_in") return getDineInFee();
    if (selectedOrderType === "pickup") return getPickupFee();
    return 0;
  };

  const getTaxAmount = () => {
    return (getSubtotal() * taxPercentage) / 100;
  };

  const getTotalPrice = () => {
    const baseTotal = getSubtotal() + getActiveFee() + getTaxAmount();
    const loyaltyDisc = (useLoyaltyPoints && loyaltyPoints) ? loyaltyAppliedDiscount : 0;
    const coupDisc = appliedCoupon ? couponDiscount : 0;
    return Math.max(0, baseTotal - loyaltyDisc - coupDisc);
  };

  const handleApplyCoupon = () => {
    setCouponError(null);
    setCouponSuccess(null);

    if (!couponInput.trim()) {
      setCouponError("يرجى إدخال كود كوبون صحيح.");
      return;
    }

    const inputCode = couponInput.trim().toUpperCase();
    const coupons = restaurant?.coupons || [];
    const matched = coupons.find((c: any) => c.code === inputCode);

    if (!matched) {
      setCouponError("كود الخصم غير صحيح أو منتهي الصلاحية.");
      setAppliedCoupon(null);
      setCouponDiscount(0);
      return;
    }

    if (!matched.isActive) {
      setCouponError("كود الخصم هذا تم إيقافه مؤقتاً.");
      setAppliedCoupon(null);
      setCouponDiscount(0);
      return;
    }

    const subtotal = getSubtotal();
    if (matched.minOrderValue && subtotal < matched.minOrderValue) {
      setCouponError(`الحد الأدنى للأوردر لتطبيق هذا الخصم هو ${matched.minOrderValue} ج.م (قيمة السلة الحالية: ${subtotal} ج.م)`);
      setAppliedCoupon(null);
      setCouponDiscount(0);
      return;
    }

    let discountAmount = 0;
    if (matched.type === "percentage") {
      discountAmount = (subtotal * matched.value) / 100;
    } else {
      discountAmount = matched.value;
    }

    discountAmount = Math.min(discountAmount, subtotal);

    setAppliedCoupon(matched);
    setCouponDiscount(discountAmount);
    setCouponSuccess(`تم تطبيق كود الخصم (${matched.code}) بنجاح! خصم قدره ${discountAmount.toFixed(2)} ج.م 🎉`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput("");
    setCouponError(null);
    setCouponSuccess(null);
  };

  // Keep coupon discount updated if items or subtotal edit happens
  useEffect(() => {
    if (appliedCoupon) {
      const subtotal = getSubtotal();
      if (appliedCoupon.minOrderValue && subtotal < appliedCoupon.minOrderValue) {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponError(`تم إلغاء كود الخصم لأن قيمة السلة أصبحت أقل من الحد الأدنى.`);
        setCouponSuccess(null);
      } else {
        let discountAmount = 0;
        if (appliedCoupon.type === "percentage") {
          discountAmount = (subtotal * appliedCoupon.value) / 100;
        } else {
          discountAmount = appliedCoupon.value;
        }
        discountAmount = Math.min(discountAmount, subtotal);
        setCouponDiscount(discountAmount);
      }
    }
  }, [cart, appliedCoupon]);

  // Loyalty discount effect & verification
  useEffect(() => {
    if (useLoyaltyPoints && loyaltyPoints) {
      const discountVal = loyaltyPoints * (restaurant?.pointValueEgp || 0.05);
      setLoyaltyAppliedDiscount(discountVal);
    } else {
      setLoyaltyAppliedDiscount(0);
    }
  }, [useLoyaltyPoints, loyaltyPoints, restaurant?.pointValueEgp]);

  const checkLoyaltyPoints = async (phoneToCheck?: string) => {
    const phone = phoneToCheck || customerPhone;
    if (!phone || phone.length < 10) {
      setLoyaltyError("يرجى كتابة رقم هاتف صحيح (10 أرقام على الأقل) للتحقق من النقاط");
      return;
    }
    setCheckingLoyalty(true);
    setLoyaltyError(null);
    try {
      const actualStoreId = realStoreId || storeId;
      if (!actualStoreId) return;
      const loyaltyRef = doc(db, "restaurants", actualStoreId, "loyalty_users", phone);
      const snap = await getDoc(loyaltyRef);
      if (snap.exists()) {
        const points = snap.data().points || 0;
        setLoyaltyPoints(points);
        if (points === 0) {
          setLoyaltyError("رقمك مسجل بنظام الولاء ولكن رصيدك الحالي 0 نقاط. تزداد نقاطك مع كل طلب يتم توصيله! 🌟");
        }
      } else {
        setLoyaltyPoints(0);
        setLoyaltyError("رقمك غير مسجل في نظام النقاط حتى الآن. عند تأكيد وتوصيل أول طلب لك، سيتم تفعيل حساب الولاء الخاص بك وإضافة نقاطك تلقائياً! 🎉");
      }
    } catch (err) {
      console.error("Error checking loyalty points:", err);
      setLoyaltyError("فشل التحقق من النقاط، يرجى المحاولة لاحقاً.");
    } finally {
      setCheckingLoyalty(false);
    }
  };

  // AI Chat message sending handler
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !restaurant) return;

    const userText = newMessage.trim();
    // Append user message immediately
    const updatedMessages = [...chatMessages, { role: "user" as const, text: userText }];
    setChatMessages(updatedMessages);
    setNewMessage("");
    setSendingMsg(true);

    try {
      const response = await fetch("/api/ai/support-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: userText,
          history: chatMessages.slice(-10),
          restaurantInfo: {
            name: restaurant.name,
            phone: restaurant.phone,
            address: restaurant.address,
            branches: branches
          },
          menuItems: menuItems,
          activeOrder: trackedOrder || undefined,
        }),
      });

      const data = await response.json();
      if (data.response) {
        setChatMessages((prev) => [...prev, { role: "model" as const, text: data.response }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "model" as const, text: "عذراً، حدث خطأ أثناء معالجة رد الذكاء الاصطناعي." }]);
      }
    } catch (err) {
      console.error("AI Support error:", err);
      setChatMessages((prev) => [...prev, { role: "model" as const, text: "عذراً واجهت مشكلة في الاتصال بخادم دعم الذكاء الاصطناعي." }]);
    } finally {
      setSendingMsg(false);
    }
  };

  // Complete Order Checkout
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    const openState = getRestaurantOpenStatus();
    if (openState && !openState.isOpenNow) {
      showToastMessage(`نأسف، استقبال الطلبات مغلق حالياً: ${openState.scheduleMsg}`, "error");
      return;
    }

    if (!customerName || !customerPhone) {
      showToastMessage("يرجى ملء اسمك ورقم الهاتف لإقرار الطلب.", "error");
      return;
    }

    if (!customerAge) {
      showToastMessage("يرجى كتابة السن لإكمال بيانات الشراء.", "error");
      return;
    }

    if (!customerGovernorate || !customerStreet) {
      showToastMessage("يرجى تعيين المحافظة والشارع لسرعة الشحن والتوصيل.", "error");
      return;
    }

    if (selectedOrderType === "dine_in" && !tableNumber) {
      const type = restaurant?.businessType || 'restaurant';
      const msg = type === 'supermarket' ? "يرجى كتابة ملاحظة أو اسم الرف/الفرع للاستلام." :
                  type === 'clothing' ? "يرجى تحديد ملاحظات أو مقاس المعاينة وتجربة القياس بالبوتيك." :
                  type === 'accessories' ? "يرجى كتابة تفاصيل المعاينة بالمعرض." : "يرجى تحديد رقم الطاولة.";
      showToastMessage(msg, "error");
      return;
    }

    if (selectedOrderType === "delivery" && !deliveryAddress) {
      showToastMessage("يرجى تعيين عنوان توصيل المنزل بالتفصيل.", "error");
      return;
    }

    if (selectedOrderType === "pickup" && branches.length > 0 && !selectedBranchId) {
      showToastMessage("يرجى اختيار فرع الاستلام المطلوب.", "error");
      return;
    }

    // Geolocation constraints
    if (selectedOrderType === "dine_in" && !bypassLocationCheck && isInsideZone === false) {
      showToastMessage("لا يمكن إتمام طلب الصالة لأنك خارج نطاق الجغرافي للمطعم. يرجى اختيار التوصيل للمنزل.", "error");
      return;
    }

    if (selectedOrderType === "delivery") {
      const maxRadius = restaurant?.deliveryRadius || 10;
      if (distanceMeters === null) {
        showToastMessage("يرجى التقاط وتحديث موقعكم الجغرافي بالـ GPS للتأكد من التواجد والتوافق في زون شحن المطعم المتاح.", "error");
        return;
      }
      const distKm = distanceMeters / 1000;
      if (distKm > maxRadius) {
        showToastMessage(`عذراً! يبعد موقعك الجغرافي الحالي ${distKm.toFixed(2)} كم وهو خارج زون التوصيل الأقصى المعتمد لدى إدارة المطعم وهو ${maxRadius} كم. لا يمكنك إتمام الطلب.`, "error");
        return;
      }
    }

    if ((selectedPaymentMethod === "instapay" || selectedPaymentMethod === "vodafone_cash") && !paymentScreenshot) {
      showToastMessage("عذراً! يجب إرسال سكرين شوت إثبات التحويل (إنستا باي أو فودافون كاش) قبل إرسال الطلب لإتمام العملية بنجاح كما يشترط صاحب المطعم.", "error");
      return;
    }

    try {
      let selectedB = branches.find((b) => b.id === selectedBranchId);
      const actualStoreId = realStoreId || storeId;
      const pointsUsed = (useLoyaltyPoints && loyaltyPoints) ? loyaltyPoints : 0;
      const discountApplied = useLoyaltyPoints ? loyaltyAppliedDiscount : 0;
      const subTotal = getSubtotal();
      const pointsEarnedEst = Math.floor((subTotal / 10) * (restaurant?.pointsPerTenEgp || 1));

      // Generate daily sequential order number starting with 1
      let dailyOrderNumber = "1";
      let dailySerialNum = 1;
      try {
        const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" in UTC
        const dayOrdersQuery = query(
          collection(db, "orders"),
          where("restaurantId", "==", actualStoreId),
          where("createdAt", ">=", todayStr)
        );
        const dayOrdersSnap = await getDocs(dayOrdersQuery);
        const todayCount = dayOrdersSnap.size;
        dailySerialNum = 1 + todayCount;
        dailyOrderNumber = `${dailySerialNum}`;
      } catch (seqErr) {
        console.error("Error generating daily order number:", seqErr);
      }

      const orderData: Order = {
        id: "", // generated by firestore
        restaurantId: actualStoreId,
        customerName,
        customerPhone,
        customerAge: parseInt(customerAge, 10) || undefined,
        customerGovernorate,
        customerStreet,
        orderType: selectedOrderType,
        tableNumber: selectedOrderType === "dine_in" ? tableNumber : undefined,
        deliveryAddress: selectedOrderType === "delivery" ? deliveryAddress : undefined,
        pickupBranchId: selectedOrderType === "pickup" ? selectedBranchId : undefined,
        pickupBranchName: (selectedOrderType === "pickup" && selectedB) ? selectedB.name : undefined,
        paymentMethod: selectedPaymentMethod,
        paymentScreenshot: paymentScreenshot || undefined,
        items: cart,
        totalPrice: getTotalPrice(),
        deliveryFee: selectedOrderType === "delivery" ? getDeliveryFee() : undefined,
        dineInFee: selectedOrderType === "dine_in" ? getDineInFee() : undefined,
        pickupFee: selectedOrderType === "pickup" ? getPickupFee() : undefined,
        status: "pending",
        createdAt: new Date().toISOString(),
        loyaltyPointsUsed: pointsUsed,
        loyaltyDiscountApplied: discountApplied,
        loyaltyPointsEarnedEstimated: pointsEarnedEst,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        couponDiscountApplied: appliedCoupon ? couponDiscount : undefined,
        discountAppliedTotal: discountApplied + (appliedCoupon ? couponDiscount : 0),
        dailyOrderNumber: dailyOrderNumber,
        dailySerial: dailySerialNum
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);

      // Log order creation to activity log
      try {
        await addDoc(collection(db, "restaurants", actualStoreId, "activity_logs"), {
          type: "order_created",
          userRole: "customer",
          description: `قام العميل بإنشاء طلب جديد رقم (${dailyOrderNumber}) بقيمة ${orderData.totalPrice} ج.م [طريقة الدفع: ${orderData.paymentMethod === "cash" ? "كاش عند الاستلام" : orderData.paymentMethod === "instapay" ? "إنستا باي" : "فيزا"}]`,
          orderId: docRef.id,
          timestamp: new Date().toISOString()
        });
      } catch (logErr) {
        console.error("Failed to log order activity to Firestore:", logErr);
      }

      // Deduct used loyalty points from database
      if (pointsUsed > 0 && actualStoreId) {
        const loyaltyRef = doc(db, "restaurants", actualStoreId, "loyalty_users", customerPhone);
        await setDoc(loyaltyRef, {
          points: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setLoyaltyPoints(0);
        setUseLoyaltyPoints(false);
      }
      
      // Save order tracking and user profile locally for convenience
      saveActiveOrder(docRef.id);
      
      const profileData = {
        name: customerName,
        phone: customerPhone,
        age: customerAge,
        governorate: customerGovernorate,
        street: customerStreet,
        address: deliveryAddress
      };
      localStorage.setItem("user_profile", JSON.stringify(profileData));

      setCart([]);
      setIsCheckingOut(false);
      setActiveTab("orders"); // route instantly to tracked orders tab!
    } catch (err) {
      console.error(err);
      showToastMessage("خطأ في تسجيل وإرسال طلب مطبخك.", "error");
    }
  };

  if (loading || dbMenuItems === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center font-sans">
        <div className="space-y-3">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-extrabold text-slate-800 animate-pulse">جاري جلب أحدث قائمة طعام محدثة لحظياً... ☁️✨</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md bg-red-50 text-red-800 rounded-3xl p-8 border border-red-200">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-extrabold mt-3 select-all">عذراً! واجهنا صعوبة</h2>
          <p className="text-xs text-red-700/80 mt-2 leading-relaxed">{error || "المطعم غير مفعّل حالياً بقرار من إدارة إسلام فود."}</p>
        </div>
      </div>
    );
  }

  const categories = ["الكل", ...Array.from(new Set(menuItems.map((item) => item.category)))];

  const filteredItems = selectedCategory === "الكل"
    ? menuItems
    : menuItems.filter((item) => item.category === selectedCategory);

  const groupedCategories = selectedCategory === "الكل"
    ? Array.from(new Set(menuItems.map((item) => item.category))).map((catName) => ({
        name: catName,
        items: menuItems.filter((item) => item.category === catName)
      })).filter(g => g.items.length > 0)
    : [{
        name: selectedCategory,
        items: filteredItems
      }].filter(g => g.items.length > 0);

  const getCategoryThumbnail = (catName: string) => {
    if (catName === "الكل") return null;
    const itemWithImg = menuItems.find(item => item.category === catName && item.image);
    if (itemWithImg && itemWithImg.image) return itemWithImg.image;

    const nameLower = catName.toLowerCase();
    if (nameLower.includes("كشري")) {
      return "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("طاجن") || nameLower.includes("طواجن")) {
      return "https://images.unsplash.com/photo-1580442151529-343f2f5e0e27?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("موتزاريلا") || nameLower.includes("جبن") || nameLower.includes("بيتزا")) {
      return "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("شاورما") || nameLower.includes("لحم")) {
      return "https://images.unsplash.com/photo-1626700051175-6518c4793f0c?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("فراخ") || nameLower.includes("دجاج")) {
      return "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("مشروبات") || nameLower.includes("عصير")) {
      return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=150&auto=format&fit=crop";
    }
    if (nameLower.includes("حلو") || nameLower.includes("حلويات")) {
      return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=150&auto=format&fit=crop";
    }
    return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=150&auto=format&fit=crop";
  };

  const bannerImages = [
    restaurant.image || globalSettings?.appBannerUrl1 || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
    globalSettings?.appBannerUrl2 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
    globalSettings?.appBannerUrl3 || "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800"
  ];



  const totalCartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Dynamic theme engine mapping
  const selectedTheme = restaurant?.theme || 'bold';
  
  let themeBgColor = "#f8fafc"; // body background
  let themeCardBgColor = "#ffffff"; // card background
  let themeTextColor = "#0f172a"; // text primary
  let themeTextMutedColor = "#64748b"; // text muted
  let themeBorderColor = "#e2e8f0"; // border color
  let themeAccentColor = "#dc2626"; // primary accent (red by default for bold)
  let themeAccentHoverColor = "#b91c1c";
  let themeAccentLightColor = "#fee2e2"; // soft red
  
  if (selectedTheme === 'dark' || themeMode === 'dark') {
    themeBgColor = "#0d1117";
    themeCardBgColor = "#161b22";
    themeTextColor = "#f0f6fc";
    themeTextMutedColor = "#8b949e";
    themeBorderColor = "#30363d";
    themeAccentColor = selectedTheme === 'dark' ? "#ff7a00" : "#dc2626"; // dynamic accent
    themeAccentHoverColor = selectedTheme === 'dark' ? "#e65c00" : "#b91c1c";
    themeAccentLightColor = "rgba(255, 122, 0, 0.1)";
  } else if (selectedTheme === 'warm') {
    themeBgColor = "#faf7f2";
    themeCardBgColor = "#ffffff";
    themeTextColor = "#3f2f21";
    themeTextMutedColor = "#7c6a59";
    themeBorderColor = "#f0ede6";
    themeAccentColor = "#f97316"; // orange
    themeAccentHoverColor = "#ea580c";
    themeAccentLightColor = "#ffedd5";
  } else if (selectedTheme === 'minimal') {
    themeBgColor = "#ffffff";
    themeCardBgColor = "#ffffff";
    themeTextColor = "#111827";
    themeTextMutedColor = "#6b7280";
    themeBorderColor = "#e5e7eb";
    themeAccentColor = "#111827"; // pitch black
    themeAccentHoverColor = "#1f2937";
    themeAccentLightColor = "#f3f4f6";
  } else if (selectedTheme === 'vibrant') {
    themeBgColor = "#faf9ff";
    themeCardBgColor = "#ffffff";
    themeTextColor = "#1e1b4b";
    themeTextMutedColor = "#6366f1";
    themeBorderColor = "#eef2ff";
    themeAccentColor = "#7c3aed"; // violet
    themeAccentHoverColor = "#6d28d9";
    themeAccentLightColor = "#ede9fe";
  } else if (selectedTheme === 'elegant') {
    themeBgColor = "#fbfbfa";
    themeCardBgColor = "#ffffff";
    themeTextColor = "#1f2937";
    themeTextMutedColor = "#4b5563";
    themeBorderColor = "#f3f4f6";
    themeAccentColor = "#854d0e"; // royal brown
    themeAccentHoverColor = "#713f12";
    themeAccentLightColor = "#fef9c3";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-start select-none relative">
      {/* Dynamic theme style overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        body { background-color: ${themeBgColor} !important; color: ${themeTextColor} !important; }
        .bg-slate-50, .bg-slate-100, .bg-slate-50\\/50, .bg-gray-50, .bg-gray-100 { background-color: ${themeBgColor} !important; }
        .bg-white, .bg-card { background-color: ${themeCardBgColor} !important; color: ${themeTextColor} !important; }
        .text-slate-900, .text-slate-800, .text-slate-705, .text-slate-700, .text-gray-900, .text-gray-800, .text-gray-700 { color: ${themeTextColor} !important; }
        .text-slate-600, .text-slate-500, .text-gray-650, .text-gray-600, .text-gray-500 { color: ${themeTextMutedColor} !important; }
        .border-slate-200, .border-slate-100, .border-slate-300, .border-gray-200, .border-slate-200\\/40, .border-slate-100\\/60 { border-color: ${themeBorderColor} !important; }
        .border-slate-50 { border-color: ${themeBorderColor} !important; }
        input, select, textarea { background-color: ${themeBgColor} !important; color: ${themeTextColor} !important; border-color: ${themeBorderColor} !important; }
        h1, h2, h3, h4, h5, h6 { color: ${themeTextColor} !important; }
        p { color: ${themeTextMutedColor} !important; }
        .bg-slate-200, .bg-slate-300 { background-color: ${themeBorderColor} !important; }
        
        /* Dynamic Theme accent overrides */
        .bg-orange-600 { background-color: ${themeAccentHoverColor} !important; color: white !important; }
        .bg-orange-500 { background-color: ${themeAccentColor} !important; color: white !important; }
        .text-orange-500, .text-orange-600 { color: ${themeAccentColor} !important; }
        .border-orange-500, .border-orange-600 { border-color: ${themeAccentColor} !important; }
        .bg-orange-50 { background-color: ${themeAccentLightColor} !important; }
        .text-orange-950, .text-orange-850, .text-orange-855 { color: ${themeTextColor} !important; }
      ` }} />

      {/* Dynamic Floating Toast System */}
      {toast && (
        <div 
          className={`fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xs py-3 px-4 rounded-2xl shadow-2xl z-[100] flex items-center justify-between gap-3 text-right text-xs font-black border animate-slide-down ${
            toast.type === "success" 
              ? "bg-green-600 text-white border-green-500" 
              : toast.type === "error" 
                ? "bg-red-600 text-white border-red-500" 
                : "bg-slate-900 text-white border-slate-800"
          }`} 
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}</span>
            <span className="leading-snug">{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="text-white/60 hover:text-white font-extrabold text-sm p-1 hover:bg-white/10 rounded"
          >
            ×
          </button>
        </div>
      )}

      {/* Smartphone mockup device constraint layout centered */}
      <div className="w-full max-w-md mx-auto bg-white min-h-screen shadow-2xl relative pb-20 flex flex-col text-right font-sans border-x border-slate-100" text-right="true">
        
        {/* Sticky App Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 flex items-center justify-between z-30">
          <div className="flex items-center gap-2 text-right" dir="rtl">
            <div className="bg-orange-50 p-1 rounded-full w-8 h-8 flex items-center justify-center overflow-hidden shrink-0 border border-orange-200">
              {restaurant?.customAppIcon ? (
                <img src={restaurant.customAppIcon} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : restaurant?.image ? (
                <img src={restaurant.image} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : globalSettings?.appMainLogo ? (
                <img src={globalSettings.appMainLogo} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <ChefHat className="w-4 h-4 text-orange-600" />
              )}
            </div>
            <div className="text-right">
              <h2 className="text-xs font-black text-slate-900 leading-tight">{restaurant?.customAppName || restaurant?.name}</h2>
              <p className="text-[9px] text-slate-400 font-medium">الفرع الرئيسي • {restaurant?.phone}</p>
              
              {/* social media shortcuts */}
              {(restaurant.facebookUrl || restaurant.youtubeUrl || restaurant.tiktokUrl) && (
                <div className="flex items-center gap-1.5 mt-1 justify-end">
                  {restaurant.facebookUrl && (
                    <a 
                      href={restaurant.facebookUrl.startsWith("http") ? restaurant.facebookUrl : `https://${restaurant.facebookUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-700 p-1 bg-blue-50/50 hover:bg-blue-100/70 rounded transition active:scale-95 cursor-pointer"
                      title="فيسبوك"
                    >
                      <Facebook className="w-3 h-3" />
                    </a>
                  )}
                  {restaurant.youtubeUrl && (
                    <a 
                      href={restaurant.youtubeUrl.startsWith("http") ? restaurant.youtubeUrl : `https://${restaurant.youtubeUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-red-600 hover:text-red-700 p-1 bg-red-50/50 hover:bg-red-100/70 rounded transition active:scale-95 cursor-pointer"
                      title="يوتيوب"
                    >
                      <Youtube className="w-3 h-3" />
                    </a>
                  )}
                  {restaurant.tiktokUrl && (
                    <a 
                      href={restaurant.tiktokUrl.startsWith("http") ? restaurant.tiktokUrl : `https://${restaurant.tiktokUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-800 hover:text-slate-900 p-1 bg-slate-100/50 hover:bg-slate-200/70 rounded transition active:scale-95 cursor-pointer"
                      title="تيك توك"
                    >
                      <Video className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          {(() => {
            const status = getRestaurantOpenStatus();
            if (!status) return null;
            return (
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                status.isOpenNow ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.isOpenNow ? "bg-green-600 animate-pulse" : "bg-rose-600"}`}></span>
                {status.isOpenNow ? "مفتوح حالياً" : "مغلق حالياً"}
              </span>
            );
          })()}
        </div>

        {/* Unified System/Platform Owner Broadcast Message for Customers */}
        {globalSettings?.broadcastCustomersMessage && (
          <div className="bg-orange-600 text-white px-4 py-2.5 text-[11px] font-bold text-center leading-normal tracking-wide flex items-center justify-center gap-2 animate-pulse relative z-20" dir="rtl">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{globalSettings.broadcastCustomersMessage}</span>
          </div>
        )}

        {/* Restaurant Specific Custom Welcome Message Banners */}
        {restaurant?.welcomeMessage && (
          <div className="bg-amber-50 border-b border-amber-100 text-slate-800 px-4 py-2 text-[11px] font-extrabold text-center leading-relaxed flex items-center justify-center gap-1.5 relative" dir="rtl">
            <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0 animate-bounce" />
            <span>{restaurant.welcomeMessage}</span>
          </div>
        )}
        
        {/* Dynamic Tab Body rendering */}
        <div className="flex-1 overflow-y-auto">
          
          {/* TAB 1: HOME (THE MENU PREVIEW VIEW FROM USER SNAPSHOT) */}
          {activeTab === "home" && (
            <div className="animate-fade-in">
              {/* Image banner slide container at the top of Home */}
              <div className="relative h-44 overflow-hidden bg-slate-100">
                <img
                  src={bannerImages[bannerIndex]}
                  alt="Delicious Banner"
                  className="w-full h-full object-cover transition-all duration-700 ease-in-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
              </div>

              {/* Slider Dots Indices indicators exactly matching orange, gray, gray */}
              <div className="flex justify-center gap-1.5 py-3">
                {bannerImages.map((_, idx) => (
                  <span
                    key={idx}
                    onClick={() => setBannerIndex(idx)}
                    className={`w-2 h-2 rounded-full cursor-pointer transition-all duration-300 ${
                      idx === bannerIndex ? "bg-orange-600 w-4.5" : "bg-slate-300"
                    }`}
                  />
                ))}
              </div>

              {/* WhatsApp-Style circular status drawer widget */}
              {restaurant?.id && (
                <div className="px-4 py-2">
                  <WhatsAppStatusWidget 
                    restaurantId={restaurant.id} 
                    isOwner={false} 
                    customerName={customerName || "عميل زائر"} 
                    customerPhone={customerPhone || ""} 
                  />
                </div>
              )}

              {/* Restaurant Business Hours Current Status Banner */}
              {(() => {
                const status = getRestaurantOpenStatus();
                if (!status) return null;
                return (
                  <div className={`mx-4 mb-3.5 p-3.5 rounded-2xl border text-right text-xs gap-3 flex items-center ${
                    status.isOpenNow ? "bg-green-50/50 border-green-150 text-green-950" : "bg-rose-50/50 border-rose-150 text-rose-950"
                  }`}>
                    <Clock className={`w-4.5 h-4.5 shrink-0 ${status.isOpenNow ? "text-green-600" : "text-rose-500 animate-pulse"}`} />
                    <div className="flex-1 space-y-0.5">
                      <p className="font-extrabold text-[11px] leading-tight">
                        {status.isOpenNow ? "نحن متاحون لاستقبال طلباتك حالياً! 🥳" : "نعتذر، نحن مغلقون الآن خارج أوقات العمل 💤"}
                      </p>
                      <p className="text-[10px] opacity-85 font-bold leading-normal font-sans">
                        {status.scheduleMsg}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Restaurant Headline and Story/About section */}
              {((restaurant as any).headline || (restaurant as any).story) && (
                <div className="mx-4 mb-4 p-4 rounded-3xl bg-gradient-to-br from-orange-50/20 to-amber-50/30 border border-orange-200/20 shadow-xs text-right">
                  {(restaurant as any).headline && (
                    <h3 className="font-extrabold text-xs text-orange-900 leading-snug mb-1.5 flex items-center gap-1.5 justify-start">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>{(restaurant as any).headline}</span>
                    </h3>
                  )}
                  {(restaurant as any).story && (
                    <p className="text-slate-600 text-[11px] leading-relaxed font-semibold">
                      {(restaurant as any).story}
                    </p>
                  )}
                </div>
              )}

              {/* Check if delivery Out-of-Zone condition hits */}
              {selectedOrderType === "delivery" && isOutOfZone === true ? (
                <div className="mx-4 my-6 p-6 rounded-3xl bg-red-50 border border-red-200 text-center space-y-4 animate-fade-in text-right" dir="rtl">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <MapPin className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  
                  <div className="space-y-1.5 text-center">
                    <h3 className="font-extrabold text-sm text-red-900 leading-snug">📍 نأسف، أنت خارج نطاق التغطية والتوصيل!</h3>
                    <p className="text-slate-600 text-[10.5px] leading-relaxed font-bold">
                      موقعك الحالي خارج الحد الأقصى لمسافة التوصيل المسموح بها لدينا ({restaurant?.deliveryRadius || 10} كم) لجميع فروعنا النشطة.
                    </p>
                    {nearestBranchDistanceKm !== null && (
                      <p className="text-orange-700 text-[10px] font-black leading-none bg-orange-100/50 py-1.5 px-3 rounded-lg inline-block font-sans">
                        أقرب فرع يبعد عنك: {nearestBranchDistanceKm.toFixed(2)} كم.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-red-150 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderType("pickup");
                        if (nearestBranch) {
                          setSelectedBranchId(nearestBranch.id === "main" ? "" : nearestBranch.id);
                        }
                      }}
                      className="w-full text-xs font-black bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <span>🚶 الطلب واستلام الوجبة بنفسك من الفرع</span>
                    </button>

                    <button
                      type="button"
                      onClick={verifyLocation}
                      className="w-full text-[11px] font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-2 shadow-xs transition"
                    >
                      🔄 إعادة تحديد موقعي الـ GPS
                    </button>
                  </div>
                </div>
              ) : (() => {
                const openStatus = getRestaurantOpenStatus();
                if (openStatus && !openStatus.isOpenNow) {
                  return (
                    <div className="mx-4 my-6 p-6 rounded-3xl bg-amber-50/70 border border-amber-200/80 text-center space-y-4 animate-fade-in text-right" dir="rtl">
                      <div className="w-14 h-14 bg-amber-100/80 rounded-full flex items-center justify-center mx-auto text-amber-600">
                        <Clock className="w-7 h-7 stroke-[2.5]" />
                      </div>
                      
                      <div className="space-y-2 text-center">
                        <h3 className="font-extrabold text-sm text-amber-900 leading-snug">🔒 عذراً، استقبال الطلبات مغلق حالياً!</h3>
                        <div className="text-slate-755 text-[11px] leading-relaxed font-bold max-w-sm mx-auto">
                          {restaurant?.isClosedManual ? (
                            <div className="space-y-1.5">
                              <span>قفل استقبال الطلبات مؤقتاً بقرار من الإدارة:</span>
                              <div className="bg-white/90 border border-amber-150/40 rounded-xl p-3 my-1.5 text-orange-950 font-black text-xs">
                                {openStatus.scheduleMsg}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span>المطعم مغلق حالياً خارج أوقات العمل والدوام المعتمد لليوم:</span>
                              <div className="bg-white/90 border border-amber-150/40 rounded-xl p-3 my-1.5 text-rose-800 font-extrabold text-xs">
                                {openStatus.scheduleMsg}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                          نعتذر عن عدم إتاحة المنيو والطلبيات حالياً لسلامة الخدمة. يمكنك العودة لزيارتنا فور فتح الدوام! ❤️
                        </p>
                      </div>

                      {restaurant?.phone && (
                        <div className="pt-3 border-t border-amber-200/50 text-center">
                          <a
                            href={`https://wa.me/${restaurant.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-black bg-[#fa5a00] hover:bg-[#d64d00] text-white rounded-xl py-2.5 px-6 shadow-sm transition"
                          >
                            <span>💬 راسلنا عبر الواتساب للاستفسار</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    {/* Exclusive Offers Section */}
                    {(() => {
                      const offers = menuItems.filter(item => item.originalPrice && item.originalPrice > item.price && item.isAvailable);
                      if (offers.length === 0) return null;
                      return (
                        <div className="mx-4 mb-5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                              <Sparkles className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
                              عروض حصرية مخفضة 🔥
                            </span>
                            <span className="text-[9.5px] text-orange-600 font-extrabold bg-orange-50 border border-orange-100 rounded-full px-2.5 py-0.5 animate-pulse">خصومات جبارة اليوم</span>
                          </div>
                          
                          <div className="flex overflow-x-auto gap-3.5 pb-2 no-scrollbar scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {offers.map((item) => {
                              const cartItemCount = cart.filter(i => i.id === item.id || i.id.startsWith(`${item.id}-`)).reduce((sum, i) => sum + i.quantity, 0);
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    setSelectedItemForModal(item);
                                    setItemModalNotes("");
                                    setItemModalQuantity(1);
                                    setItemModalSelectedOptions([]);
                                  }}
                                  className="w-[180px] shrink-0 bg-gradient-to-b from-white to-orange-50/10 border border-orange-200/40 rounded-2xl p-2.5 shadow-xs hover:shadow-md transition duration-200 cursor-pointer flex flex-col justify-between space-y-2 relative"
                                >
                                  {/* Discount badge */}
                                  <div className="absolute top-1.5 right-1.5 bg-red-650 text-white font-black text-[9px] px-1.5 py-0.5 rounded-md z-10 shadow-sm animate-bounce">
                                    وفر {Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)}%
                                  </div>

                                  <div className="space-y-1.5">
                                    {/* Offer Image */}
                                    <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-50 border border-orange-100/30">
                                      {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-full h-full bg-orange-100/30 text-orange-500 flex items-center justify-center">
                                          <Sparkles className="w-6 h-6 stroke-[2]" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Name & Desc */}
                                    <div className="text-right">
                                      <h4 className="font-extrabold text-[11px] text-slate-900 line-clamp-1">{item.name}</h4>
                                      <p className="text-[9px] text-slate-400 line-clamp-1 leading-normal">{item.description || "عرض خاص ومميز"}</p>
                                    </div>
                                  </div>

                                  {/* Pricing & instant Add */}
                                  <div className="flex items-center justify-between gap-1 mt-1 pt-1.5 border-t border-orange-100/35">
                                    {/* Pricing details */}
                                    <div className="text-right">
                                      <div className="text-[10.5px] font-black text-slate-950 font-sans">
                                        {item.price.toFixed(0)} ج.م
                                      </div>
                                      <div className="text-[8.5px] text-slate-400 font-bold font-sans line-through opacity-80 leading-none">
                                        {item.originalPrice!.toFixed(0)} ج.م
                                      </div>
                                    </div>

                                    {/* Add Button / Counter */}
                                    {cartItemCount > 0 ? (
                                      <div className="flex items-center gap-1 bg-orange-100/60 rounded-full p-0.5 z-10" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => {
                                            const cartItem = cart.find(i => i.id === item.id || i.id.startsWith(`${item.id}-`));
                                            if (cartItem) decreaseQuantity(cartItem.id);
                                          }}
                                          className="w-5 h-5 rounded-full bg-white text-orange-600 flex items-center justify-center font-bold text-xs"
                                        >
                                          -
                                        </button>
                                        <span className="text-[9.5px] font-bold text-orange-950 px-0.5">{cartItemCount}</span>
                                        <button
                                          onClick={() => addToCart(item)}
                                          className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs"
                                        >
                                          +
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToCart(item);
                                        }}
                                        className="bg-orange-600 hover:bg-orange-700 hover:scale-105 text-white text-[9.5px] font-black px-2.5 py-1 rounded-full shadow-xs transition duration-150 flex items-center gap-0.5"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>طلب</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Horizontal scroll list of circular category buttons */}
                    <div className="px-4">
                      <div className="flex overflow-x-auto gap-4 py-3 select-none no-scrollbar scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {(categories as string[]).map((catName: string) => {
                          const isActive = selectedCategory === catName;
                          
                          if (catName === "الكل") {
                            return (
                              <div
                                key="الكل"
                                onClick={() => setSelectedCategory("الكل")}
                                className="flex flex-col items-center cursor-pointer shrink-0 transition"
                              >
                                <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                  isActive ? "border-orange-500 bg-orange-50/25 scale-105" : "border-slate-100 bg-white hover:border-slate-300"
                                }`}>
                                  <Utensils className={`w-6 h-6 ${isActive ? "text-orange-500" : "text-slate-400"}`} />
                                </div>
                                <span className={`text-[11px] font-extrabold mt-1.5 transition ${
                                  isActive ? "text-orange-600 shadow-sm" : "text-slate-500"
                                }`}>
                                  الكل
                                </span>
                              </div>
                            );
                          }

                          const thumb = getCategoryThumbnail(catName);
                          return (
                            <div
                              key={catName}
                              onClick={() => setSelectedCategory(catName)}
                              className="flex flex-col items-center cursor-pointer shrink-0 transition"
                            >
                              <div className={`w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all duration-200 ${
                                isActive ? "border-orange-500 scale-105" : "border-slate-100"
                              }`}>
                                {thumb ? (
                                  <img src={thumb} className="w-full h-full object-cover" alt={catName} referrerPolicy="no-referrer" />
                                ) : (
                                  <Utensils className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <span className={`text-[11px] font-extrabold mt-1.5 transition ${
                                isActive ? "text-orange-600 font-bold" : "text-slate-500"
                              }`}>
                                {catName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Vertical list of products grouped beautifully by categories with polished sections */}
                    <div className="px-4 py-3 space-y-6">
                      {groupedCategories.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 space-y-2">
                          <ChefHat className="w-10 h-10 mx-auto text-slate-200 animate-pulse" />
                          <p className="text-xs font-bold leading-relaxed">لا يوجد وجبات متاحة في هذا التصنيف حالياً.</p>
                        </div>
                      ) : (
                        groupedCategories.map((group) => (
                          <div key={group.name} className="space-y-2">
                            {/* Section Category Header */}
                            <div className="flex items-center justify-between mx-1 bg-slate-50/80 border-b border-orange-100/55 py-1.5 px-3 rounded-lg sticky top-[57px] bg-white/95 backdrop-blur-xs z-10">
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                {group.name}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold font-sans">({group.items.length} صنف)</span>
                            </div>

                            {/* Section Items */}
                            <div className="divide-y divide-slate-100">
                              {group.items.map((item) => (
                                <div 
                                  key={item.id} 
                                  onClick={() => {
                                    setSelectedItemForModal(item);
                                    setItemModalNotes("");
                                    setItemModalQuantity(1);
                                    setItemModalSelectedOptions([]);
                                  }}
                                  className="flex gap-4 py-4 px-1.5 items-center relative transition duration-150 last:pb-0 first:pt-0 cursor-pointer hover:bg-slate-50/50 rounded-2xl"
                                >
                                  
                                  {/* Square image on Left */}
                                  <div className="relative w-24 h-24 sm:w-26 sm:h-26 rounded-2xl bg-slate-50 shrink-0 self-center border border-slate-100 shadow-2xs">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover rounded-2xl"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-orange-50/50 text-orange-600 flex flex-col items-center justify-center p-2 rounded-2xl border border-orange-100/40">
                                        <ChefHat className="w-6 h-6 text-orange-500 stroke-[2.5px]" />
                                        <span className="text-[9px] text-orange-600 font-bold mt-1">طعام طازج</span>
                                      </div>
                                    )}
                                    
                                    {/* Discount float tag on image */}
                                    {item.originalPrice && item.originalPrice > item.price && (
                                      <span className="absolute -bottom-1 -right-1 bg-red-650 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md shadow-xs animate-pulse">
                                        خصم 🔥
                                      </span>
                                    )}
                                  </div>

                                  {/* Content details on Right */}
                                  <div className="flex-1 text-right min-w-0 pr-1 select-all flex flex-col justify-between self-stretch">
                                    <div>
                                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                        <span>{item.name}</span>
                                        {item.originalPrice && item.originalPrice > item.price && (
                                          <span className="bg-red-50 text-red-600 text-[8.5px] font-black px-1.5 py-0.5 rounded border border-red-100">عرض خاص</span>
                                        )}
                                      </h3>
                                      {item.description ? (
                                        <p className="text-[10px] text-slate-400 mt-1 leading-normal line-clamp-2 pr-0.5">{item.description}</p>
                                      ) : (
                                        <p className="text-[9px] text-slate-350 mt-1">صنف طازج ومميز محضّر بعناية يومية فائقة.</p>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100/40">
                                      {/* Price tags */}
                                      <div className="flex items-baseline gap-1.5 font-sans">
                                        <span className="text-xs font-black text-slate-950">
                                          {item.price.toFixed(1)} ج.م
                                        </span>
                                        {item.originalPrice && item.originalPrice > item.price && (
                                          <span className="text-[10px] text-slate-400 line-through opacity-75 font-semibold">
                                            {item.originalPrice.toFixed(0)} ج.m
                                          </span>
                                        )}
                                      </div>

                                      {/* Easy +/- ordering controls */}
                                      {(() => {
                                        const cartItemCount = cart.filter(i => i.id === item.id || i.id.startsWith(`${item.id}-`)).reduce((sum, i) => sum + i.quantity, 0);
                                        if (cartItemCount > 0) {
                                          return (
                                            <div 
                                              className="flex items-center gap-2 bg-orange-600 text-white rounded-full px-2.5 py-1 shadow-xs font-bold"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                onClick={() => {
                                                  const cartItem = cart.find(i => i.id === item.id || i.id.startsWith(`${item.id}-`));
                                                  if (cartItem) decreaseQuantity(cartItem.id);
                                                }}
                                                className="w-5 h-5 rounded-full bg-orange-700 hover:bg-orange-800 text-white font-black text-xs flex items-center justify-center transition"
                                              >
                                                <Minus className="w-3 h-3 stroke-[2.5]" />
                                              </button>
                                              <span className="text-[11px] font-black font-sans min-w-[14px] text-center">{cartItemCount}</span>
                                              <button
                                                onClick={() => addToCart(item)}
                                                className="w-5 h-5 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-black text-xs flex items-center justify-center transition"
                                              >
                                                <Plus className="w-3 h-3 stroke-[2.5]" />
                                              </button>
                                            </div>
                                          );
                                        } else {
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(item);
                                              }}
                                              className="bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-full px-3 py-1 text-orange-650 text-[10px] font-black transition duration-150 flex items-center gap-1"
                                            >
                                              <Plus className="w-3 h-3 stroke-[3]" />
                                              <span>إضافة</span>
                                            </button>
                                          );
                                        }
                                      })()}
                                    </div>
                                  </div>

                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
            </>);
          })()}

              {/* Dynamic Social Media Footer - Matches Image 1 */}
              {(restaurant?.instagramUrl || restaurant?.tiktokUrl || restaurant?.facebookUrl || restaurant?.googleMapsUrl || restaurant?.googleReviewUrl || restaurant?.snapchatUrl || restaurant?.customUrl) && (
                <div className="mt-12 mb-8 px-4 text-center border-t border-dashed border-slate-200/60 pt-6">
                  <p className="text-[10px] text-slate-400 font-extrabold mb-3">تابعنا على صفحاتنا الرسمية</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {restaurant.instagramUrl && (
                      <a
                        href={restaurant.instagramUrl.startsWith("http") ? restaurant.instagramUrl : `https://${restaurant.instagramUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition"
                        title="إنستغرام"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {restaurant.tiktokUrl && (
                      <a
                        href={restaurant.tiktokUrl.startsWith("http") ? restaurant.tiktokUrl : `https://${restaurant.tiktokUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition font-black text-xs"
                        title="تيك توك"
                      >
                        𝅘𝅥𝅯
                      </a>
                    )}
                    {restaurant.facebookUrl && (
                      <a
                        href={restaurant.facebookUrl.startsWith("http") ? restaurant.facebookUrl : `https://${restaurant.facebookUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition font-sans font-black text-sm"
                        title="فيسبوك"
                      >
                        f
                      </a>
                    )}
                    {restaurant.snapchatUrl && (
                      <a
                        href={restaurant.snapchatUrl.startsWith("http") ? restaurant.snapchatUrl : `https://${restaurant.snapchatUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-[#FFFC00] flex items-center justify-center text-black shadow-xs hover:scale-105 active:scale-95 transition text-sm"
                        title="سناب شات"
                      >
                        👻
                      </a>
                    )}
                    {restaurant.googleMapsUrl && (
                      <a
                        href={restaurant.googleMapsUrl.startsWith("http") ? restaurant.googleMapsUrl : `https://${restaurant.googleMapsUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-[#EA4335] flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition"
                        title="موقعنا على الخريطة"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    {restaurant.googleReviewUrl && (
                      <a
                        href={restaurant.googleReviewUrl.startsWith("http") ? restaurant.googleReviewUrl : `https://${restaurant.googleReviewUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition"
                        title="تقييمات قوقل"
                      >
                        <Star className="w-4 h-4 fill-white text-amber-400" />
                      </a>
                    )}
                    {restaurant.customUrl && (
                      <a
                        href={restaurant.customUrl.startsWith("http") ? restaurant.customUrl : `https://${restaurant.customUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white shadow-xs hover:scale-105 active:scale-95 transition"
                        title={restaurant.customUrlLabel || "رابط مخصص"}
                      >
                        <Link className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {restaurant.customUrl && restaurant.customUrlLabel && (
                    <p className="text-[9px] text-slate-400 mt-2 font-bold">{restaurant.customUrlLabel}</p>
                  )}
                </div>
              )}

              {/* Brand signature powered by Islam Food with Spoon & Fork Logo */}
              <div className="py-8 border-t border-slate-100 flex flex-col items-center justify-center space-y-2 select-none">
                <div className="flex items-center gap-1.5 opacity-40">
                  <div className="w-6 h-6 bg-[#fa5a00] rounded-full flex items-center justify-center border border-[#fa5a00]/10">
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 128 128" fill="currentColor">
                      <path d="M 28 100 L 58 70" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
                      <path d="M 54 74 C 47 59, 77 33, 97 33 C 107 33, 107 53, 92 68 C 77 83, 61 89, 54 74 Z" />
                      <path d="M 100 100 L 70 70" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
                      <path d="M 33 33 C 43 33, 63 53, 73 73 L 53 73 L 33 53 Z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-900 tracking-wider">إسلام فود</span>
                </div>
                <p className="text-[8px] text-slate-400 font-bold tracking-wide">عالم من المذاق بين يديك • جميع الحقوق محفوظة لشركة إسلام فود © 2026</p>
              </div>

            </div>
          )}

          {/* TAB 2: CART (ITEMS COUNTER & EMBEDDED CHECKOUT FLOW) */}
          {activeTab === "cart" && (
            <div className="p-4 space-y-5 animate-fade-in">
              <h2 className="font-extrabold text-slate-900 border-b pb-2 text-sm flex items-center gap-1.5 justify-end">
                <span>سلة المأكولات الجاهزة للطلب</span>
                <ShoppingBag className="w-4 h-4 text-orange-500" />
              </h2>

              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-4">
                  <div className="bg-orange-50 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-orange-500">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-extrabold">سلة المأكولات خالية حاليًا.</p>
                  <p className="text-[10px]">تصفح المنيو الرائع لإضافه وجباتك اللذيذة والتحضير الفوري.</p>
                  <button
                    onClick={() => setActiveTab("home")}
                    className="bg-orange-600 text-white text-xs font-bold py-2 px-6 rounded-xl hover:bg-orange-700 transition"
                  >
                    تصفح المنيو الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Cart Items Listing */}
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decreaseQuantity(item.id)}
                            className="bg-slate-100 hover:bg-slate-200 font-bold p-1 rounded-md text-slate-600 transition shrink-0"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold text-sm font-mono w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => addToCart({ id: item.id, name: item.name, price: item.price } as any)}
                            className="bg-slate-100 hover:bg-slate-200 font-bold p-1 rounded-md text-slate-600 transition shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right space-y-0.5">
                          <p className="font-extrabold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono font-bold">{(item.price * item.quantity).toFixed(2)} ج.م</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary cost */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border font-extrabold text-slate-900 text-xs">
                    <span className="font-mono text-orange-600 text-sm tracking-tight">{getSubtotal().toFixed(2)} ج.م</span>
                    <span>المجموع الكلي:</span>
                  </div>

                  {/* Order Selector Tab */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-2xl border">
                    {restaurant?.allowDelivery !== false && !globalSettings?.deliveryServicesSuspended && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderType("delivery")}
                        className={`py-2 text-center text-[9px] font-extrabold rounded-xl transition ${
                          selectedOrderType === "delivery" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        🏠 دليفري للمنزل
                      </button>
                    )}
                    
                    {restaurant?.allowDineIn !== false && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderType("dine_in")}
                        className={`py-2 text-center text-[9px] font-extrabold rounded-xl transition ${
                          selectedOrderType === "dine_in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {getTerm('dinein')}
                      </button>
                    )}

                    {restaurant?.allowPickup !== false && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderType("pickup")}
                        className={`py-2 text-center text-[9px] font-extrabold rounded-xl transition ${
                          selectedOrderType === "pickup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        🚶 استلام من الفرع
                      </button>
                    )}
                  </div>

                  {globalSettings?.deliveryServicesSuspended && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl text-[10px] font-extrabold text-center leading-normal" dir="rtl">
                      ⚠️ نعتذر منكم، تم إيقاف خدمة التوصيل للمنازل (الدليفري) مؤقتاً بالمنظومة بالكامل. يمكنك اختيار استلام من الفرع أو صالة.
                    </div>
                  )}

                  {/* Geolocation matching for dine-in */}
                  {selectedOrderType === "dine_in" && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-right">
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={verifyLocation}
                          className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border hover:bg-orange-100 transition"
                        >
                          تحديث الموقع
                        </button>
                        <span className="text-[10px] font-extrabold text-slate-800 flex items-center gap-1">
                          <Compass className="w-3 text-orange-500" />
                          المطابقة الجغرافية لموقع {getTerm('store')} المباشر
                        </span>
                      </div>

                      {checkingLocation ? (
                        <p className="text-[9px] text-orange-600 animate-pulse">جاري فحص الـ GPS للتحقق الجغرافي من موقعك بالفرع...</p>
                      ) : isInsideZone === true ? (
                        <div className="text-[9px] text-green-700 bg-green-50 p-2 rounded-xl flex items-center gap-1.5 justify-end">
                          <span>تم التحقق! أنت بداخل محيط المنشأة ({distanceMeters} م).</span>
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        </div>
                      ) : isInsideZone === false ? (
                        <div className="space-y-1.5">
                          <div className="text-[9px] text-red-700 bg-red-50 p-2 rounded-xl border border-red-200 leading-relaxed justify-end">
                            عفواً! لم تكتشف إشارتك داخل الفرع ({distanceMeters} م من {getTerm('store')}).
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setBypassLocationCheck(true);
                              setIsInsideZone(true);
                            }}
                            className="text-[9px] underline text-blue-600 font-bold hover:text-blue-700 block text-center"
                          >
                            تخطي الفحص الجغرافي للتجربة والتقييم
                          </button>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-500">بانتظار التقاط GPS للتحقق والتفعيل...</p>
                      )}
                    </div>
                  )}

                  {/* Geolocation matching for delivery */}
                  {selectedOrderType === "delivery" && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2 text-right shadow-xs" dir="rtl">
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={verifyLocation}
                          className="text-[9px] font-black text-white bg-orange-600 hover:bg-orange-700 px-2.5 py-1 rounded-lg transition"
                        >
                          تحديث موقع الـ GPS 🛰️
                        </button>
                        <span className="text-[10px] font-extrabold text-slate-800 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-orange-500 animate-spin-slow" />
                          التحقق من زون ومسافة الديليفري للمنزل
                        </span>
                      </div>

                      {checkingLocation ? (
                        <p className="text-[9.5px] text-orange-600 animate-pulse font-extrabold">جاري حساب المسافة بدقة بين جهازك ومقر إدارة المطعم...</p>
                      ) : distanceMeters !== null ? (
                        (() => {
                          const distKm = distanceMeters / 1000;
                          const maxRadius = restaurant?.deliveryRadius || 10;
                          const isAllowed = distKm <= maxRadius;
                          return isAllowed ? (
                            <div className="text-[10px] text-green-800 bg-green-50/80 p-2.5 rounded-xl border border-green-200 leading-relaxed font-bold">
                              <span className="flex items-center gap-1.5 justify-end">
                                <span>خدمة الديليفري مدعومة لعنوانك الجغرافي الفعلي! زون التوصيل متاح بنجاح ✅</span>
                                <Check className="w-4 h-4 shrink-0 text-green-600" />
                              </span>
                              <span className="block text-slate-500 text-[9px] mt-1 font-semibold">
                                تبعد مسافة <strong className="text-green-700 font-extrabold">{distKm.toFixed(2)} كم</strong> عن مقر المطعم (النطاق الأقصى لسيارات الشحن: {maxRadius} كم)
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-red-800 bg-red-50 p-2.5 rounded-xl border border-red-200 leading-relaxed font-extrabold">
                              <span className="flex items-center gap-1.5 justify-end">
                                <span>عفواً! موقعك يقع خارج خريطة زون توصيل المحل ❌</span>
                                <X className="w-4 h-4 shrink-0 text-red-650" />
                              </span>
                              <span className="block text-red-650 text-[9px] mt-1 font-semibold">
                                تبعد مسافة <strong className="font-extrabold text-base bg-red-100 px-1 py-0.5 rounded">{distKm.toFixed(2)} كم</strong> وهو أكبر من المسموح به لعامة الطيارين وهو <strong className="font-extrabold text-slate-900 bg-slate-200/50 px-1.5 py-0.5 rounded">{maxRadius} كم</strong>.
                              </span>
                              <span className="block text-[8.5px] text-slate-500 mt-1 font-medium">للأسف، لا يمكن الشحن لعنوانك الحالي.</span>
                            </div>
                          );
                        })()
                      ) : locationError ? (
                        <div className="space-y-1.5">
                          <div className="text-[9.5px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed justify-end font-semibold">
                            ⚠️ تعذر تحديد موقع هاتفكم بالـ GPS تلقائياً: {locationError === "User denied Geolocation" ? "تم حظر إذن الوصول للموقع" : "يرجى تشغيل الـ GPS وسماح المتصفح باكتشافك بالتوصيل"}.
                          </div>
                          <button
                            type="button"
                            onClick={verifyLocation}
                            className="w-full text-center text-[10px] font-black text-white bg-orange-600 hover:bg-orange-700 rounded-lg py-2 transition shadow"
                          >
                            تأكيد الإذن وإعطاء صلاحية الموقع 🛰️
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-center bg-slate-100/50 p-2.5 rounded-xl">
                          <p className="text-[9.5px] text-slate-600 font-semibold leading-relaxed">لتوصيل الديليفري، يتطلب نظام الحماية فحص المسافة بين جهازك والمطعم لتفادي تعطل الشحنات.</p>
                          <button
                            type="button"
                            onClick={verifyLocation}
                            className="w-full text-center text-[10px] font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg py-2 transition"
                          >
                            التحقق الفوري من التواجد بنطاق الديليفري (GPS) 🛰️
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Embedded checkout form */}
                  <form onSubmit={handlePlaceOrder} className="space-y-3.5 bg-slate-50/50 p-3.5 rounded-2xl border">
                    <span className="text-[10.5px] font-black text-slate-800 block border-b pb-1.5">📋 البيانات الشخصية وبيانات الموقع</span>
                    
                    <div className="space-y-2.5 text-right">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-700">الاسم بالكامل *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: أحمد مصطفى"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Age */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-700">السن *</label>
                          <input
                            type="number"
                            required
                            min="10"
                            max="100"
                            placeholder="مثال: 25"
                            value={customerAge}
                            onChange={(e) => setCustomerAge(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white"
                          />
                        </div>

                        {/* Phone */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-700">رقم الهاتف *</label>
                          <input
                            type="tel"
                            required
                            placeholder="مثال: 01012345678"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Governorate */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-700">المحافظة *</label>
                          <select
                            value={customerGovernorate}
                            onChange={(e) => setCustomerGovernorate(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white font-bold text-slate-800"
                          >
                            <option value="القاهرة">القاهرة</option>
                            <option value="الجيزة">الجيزة</option>
                            <option value="الإسكندرية">الإسكندرية</option>
                            <option value="القليوبية">القليوبية</option>
                            <option value="الدقهلية">الدقهلية</option>
                            <option value="الغربية">الغربية</option>
                            <option value="الشرقية">الشرقية</option>
                            <option value="المنوفية">المنوفية</option>
                            <option value="البحيرة">البحيرة</option>
                            <option value="دمياط">دمياط</option>
                            <option value="بورسعيد">بورسعيد</option>
                            <option value="قنا">قنا</option>
                            <option value="أسوان">أسوان</option>
                          </select>
                        </div>

                        {/* Street */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-700">الشارع والمنطقة *</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: شارع شهاب"
                            value={customerStreet}
                            onChange={(e) => setCustomerStreet(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white"
                          />
                        </div>
                      </div>

                      {/* Diner condition */}
                      {selectedOrderType === "dine_in" && (
                        <div className="space-y-1 animate-fade-in bg-orange-50/50 p-3 rounded-xl border border-orange-200">
                          <label className="block text-xs font-bold text-slate-700">
                            {restaurant?.businessType === 'supermarket' ? 'ملاحظة الاستلام من الرف بالفرع *' :
                             restaurant?.businessType === 'clothing' ? 'ملاحظة المعاينة وقياس الملابس بالبوتيك *' :
                             restaurant?.businessType === 'accessories' ? 'ملاحظة جناح عرض المعروضات بالمعرض *' :
                             'رقم الطاولة المتواجد عليها بالصالة *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={
                              restaurant?.businessType === 'supermarket' ? 'مثال: استلام من قسم الأغذية المجمدة بممرات الفرع' :
                              restaurant?.businessType === 'clothing' ? 'مثال: تجربة مقاس XL في غرفة القياس الفردية' :
                              restaurant?.businessType === 'accessories' ? 'مثال: طلب تعبئة كصندوق هدايا بالخلفية الوردية' :
                              'مثال: طاولة رقم 4 الصالة الأمامية'
                            }
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white"
                          />
                        </div>
                      )}

                      {/* Delivery condition */}
                      {selectedOrderType === "delivery" && (
                        <div className="space-y-1 animate-fade-in bg-slate-100 p-2.5 rounded-xl border">
                          <label className="block text-xs font-bold text-slate-700">العنوان بالتفصيل والدور والشقة *</label>
                          <input
                            type="text"
                            required
                            placeholder="العمارة والدور والشقة مع أقرب علامة مميزة"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white"
                          />
                        </div>
                      )}

                      {/* Pickup condition */}
                      {selectedOrderType === "pickup" && (
                        <div className="space-y-1 animate-fade-in bg-blue-50/20 p-2.5 rounded-xl border border-blue-200">
                          <label className="block text-xs font-bold text-slate-800">فرع الاستلام المطلوب *</label>
                          {branches.length === 0 ? (
                            <div className="text-[10px] text-slate-600 bg-white p-2.5 rounded-xl border">
                              <strong>الفرع الرئيسي:</strong> {restaurant?.address}
                            </div>
                          ) : (
                            <select
                              value={selectedBranchId}
                              onChange={(e) => setSelectedBranchId(e.target.value)}
                              className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white font-bold text-slate-700"
                            >
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} - {b.address}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Loyalty Points System panel */}
                    {restaurant?.loyaltyEnabled && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 mt-4 space-y-3 shadow-sm text-right" dir="rtl">
                        <div className="flex items-center justify-between border-b border-orange-100/70 pb-2">
                          <span className="flex items-center gap-1.5 text-xs font-black text-orange-850">
                            <Sparkles className="w-4 h-4 text-orange-600 animate-pulse" />
                            <span>نظام هدايا ونقاط زبائن إسلام فود 🎁</span>
                          </span>
                          <span className="text-[9px] font-bold text-orange-650 bg-orange-100/80 py-0.5 px-2 rounded-full font-mono">كل 10 جنيه = {restaurant.pointsPerTenEgp || 1} نقطة</span>
                        </div>
                        
                        <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                          اجمع نقاطاً مع كل وجبة تطلبها واستبدلها بخصومات مالية مباشرة على الفاتورة!
                        </p>

                        <div className="flex items-center gap-2 pt-1 font-sans">
                          <button
                            type="button"
                            onClick={() => checkLoyaltyPoints()}
                            disabled={checkingLoyalty}
                            className="bg-orange-600 hover:bg-orange-700 text-white transition py-1.5 px-3 rounded-xl font-black text-[10.5px] cursor-pointer disabled:opacity-50 shrink-0 shadow active:scale-98"
                          >
                            {checkingLoyalty ? "جاري الاستعلام..." : "فحص واسترداد نقاطي 🔍"}
                          </button>
                          <span className="text-[10.5px] text-slate-500 font-bold">برقم هاتف الطلب أعلاه</span>
                        </div>

                        {loyaltyPoints !== null && (
                          <div className="mt-2.5 space-y-2 bg-white/85 border border-orange-100 rounded-xl p-3 text-xs animate-fade-in font-sans">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 font-extrabold">نقاطك المسجلة:</span>
                              <span className="font-mono font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded border border-orange-100">{loyaltyPoints} نقطة</span>
                            </div>
                            {loyaltyPoints > 0 ? (
                              <div className="space-y-2 border-t border-slate-100 pt-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-green-700 font-sans">تعادل خصماً مالياً بقيمة:</span>
                                    <span className="text-[11.5px] font-black font-mono text-slate-800">{(loyaltyPoints * (restaurant?.pointValueEgp || 0.05)).toFixed(2)} ج.م</span>
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-black text-orange-950 bg-orange-100/50 py-1.5 px-3 rounded-xl hover:bg-orange-100 transition">
                                    <input
                                      type="checkbox"
                                      checked={useLoyaltyPoints}
                                      onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                                      className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>استخدام الخصم الآن خصم!</span>
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {loyaltyError && (
                          <p className="text-[10px] text-orange-850 font-medium leading-relaxed mt-2 bg-orange-100/20 p-2.5 rounded-xl border border-orange-100/50">{loyaltyError}</p>
                        )}
                      </div>
                    )}

                    {/* Coupon / Promo Code Panel */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mt-4 space-y-3 shadow-sm text-right font-sans" dir="rtl">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950 border-b border-indigo-100/70 pb-2">
                        <span className="text-sm">🎟️</span>
                        <span>هل تمتلك كود خصم / كوبون لتوفير المال؟</span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="مثال: WELCOME10"
                          disabled={appliedCoupon !== null}
                          className="flex-1 text-xs border rounded-xl py-2 px-3 text-left font-bold font-mono tracking-wider bg-white uppercase placeholder:text-[10px] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                          dir="ltr"
                        />
                        {appliedCoupon ? (
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="bg-red-50 hover:bg-red-100 text-red-700 transition py-2 px-3.5 rounded-xl font-bold text-[10.5px]"
                          >
                            حذف 🗑️
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white transition py-2 px-3.5 rounded-xl font-black text-[10.5px]"
                          >
                            تطبيق كود
                          </button>
                        )}
                      </div>

                      {couponError && (
                        <p className="text-[10px] text-red-700 bg-red-100/20 p-2.5 rounded-xl border border-red-200/40 font-semibold">{couponError}</p>
                      )}

                      {couponSuccess && (
                        <p className="text-[10px] text-green-800 bg-green-100/20 p-2.5 rounded-xl border border-green-200/40 font-semibold">{couponSuccess}</p>
                      )}
                    </div>

                    {/* Invoice Summary Breakdown */}
                    <div className="space-y-1.5 bg-slate-50 border border-slate-100 p-3 rounded-2xl mt-4 text-[11px] font-sans">
                      <span className="text-[10px] font-extrabold text-slate-800 block border-b pb-1">📄 ملخص وتفاصيل الفاتورة الإلكترونية</span>
                      
                      <div className="flex justify-between items-center text-slate-600 font-medium pt-1">
                        <span>إجمالي ثمن الوجبات والأطعمة:</span>
                        <span className="font-mono font-bold">{getSubtotal().toFixed(2)} {currencySymbol}</span>
                      </div>

                      {useLoyaltyPoints && loyaltyPoints && loyaltyPoints > 0 && (
                        <div className="flex justify-between items-center text-green-750 font-black bg-green-50/70 border border-green-105 px-1.5 py-1 rounded-xl animate-pulse">
                          <span>🎁 خصم نظام نقاط الولاء المستردة:</span>
                          <span className="font-mono text-xs font-black">-{loyaltyAppliedDiscount.toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      {selectedOrderType === "delivery" && getDeliveryFee() > 0 && (
                        <div className="flex justify-between items-center text-orange-700/95 font-semibold bg-orange-50/40 px-1 py-0.5 rounded">
                          <span>🛵 رسوم خدمة التوصيل للمنزل:</span>
                          <span className="font-mono font-black">+{getDeliveryFee().toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      {selectedOrderType === "dine_in" && getDineInFee() > 0 && (
                        <div className="flex justify-between items-center text-purple-700/95 font-semibold bg-purple-50/40 px-1 py-0.5 rounded">
                          <span>🍽️ رسوم خدمة الصالة وحجز الطاولة:</span>
                          <span className="font-mono font-black">+{getDineInFee().toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      {selectedOrderType === "pickup" && getPickupFee() > 0 && (
                        <div className="flex justify-between items-center text-blue-700/95 font-semibold bg-blue-50/40 px-1 py-0.5 rounded">
                          <span>🛍️ رسوم خدمة تجهيز الاستلام والتحميل:</span>
                          <span className="font-mono font-black">+{getPickupFee().toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      {taxPercentage > 0 && (
                        <div className="flex justify-between items-center text-slate-600 font-semibold bg-slate-100/50 px-1 py-0.5 rounded">
                          <span>💸 ضريبة القيمة المضافة ({taxPercentage}%):</span>
                          <span className="font-mono font-black">+{getTaxAmount().toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      {appliedCoupon && (
                        <div className="flex justify-between items-center text-indigo-800 font-black bg-indigo-50/70 border border-indigo-150 px-1.5 py-1 rounded-xl">
                          <span>🎟️ خصم الكوبون المسترد ({appliedCoupon.code}):</span>
                          <span className="font-mono text-xs font-black">-{couponDiscount.toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 text-xs font-black text-slate-900 bg-orange-100/30 p-1.5 rounded-xl">
                        <span>المطلوب سداده (الصافي):</span>
                        <span className="font-mono text-orange-600 text-sm">{getTotalPrice().toFixed(2)} {currencySymbol}</span>
                      </div>

                      {restaurant?.loyaltyEnabled && (
                        <div className="text-[9px] text-orange-700 bg-orange-50/70 p-2 rounded-xl text-center font-bold border border-orange-100/30 font-sans mt-1">
                          🎉 هذا الطلب يمنحك رصيد قدره <span className="font-mono underline">{Math.floor((getSubtotal() / 10) * (restaurant?.pointsPerTenEgp || 1))}</span> من نقاط الولاء التي تضاف تلقائياً لحسابك بعد استلام وتأكيد الطلب!
                        </div>
                      )}
                    </div>

                    {/* Embedded Payment options */}
                    <div className="space-y-2 bg-white/70 p-3 rounded-2xl border mt-3 text-right font-sans" dir="rtl">
                      <span className="text-[10px] font-black text-slate-800 block">💳 طريقة الدفع وإتمام الفاتورة</span>
                      <div className="flex flex-wrap gap-1.5">
                        {restaurant?.allowCash !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod("cash");
                              setPaymentScreenshot(null);
                            }}
                            className={`flex-1 min-w-[70px] py-1.5 px-0.5 text-[9px] font-bold rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                              selectedPaymentMethod === "cash"
                                ? "bg-orange-50 border-orange-500 text-orange-850 font-extrabold"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-[11px]">💵 كاش</span>
                            <span className="text-[7.5px] text-slate-400 font-normal">عند الاستلام</span>
                          </button>
                        )}

                        {restaurant?.allowVisa !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod("visa");
                              setPaymentScreenshot(null);
                            }}
                            className={`flex-1 min-w-[70px] py-1.5 px-0.5 text-[9px] font-bold rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                              selectedPaymentMethod === "visa"
                                ? "bg-orange-50 border-orange-500 text-orange-850 font-extrabold"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-[11px]">💳 فيزا</span>
                            <span className="text-[7.5px] text-slate-400 font-normal">أون لاين</span>
                          </button>
                        )}

                        {restaurant?.allowInstapay !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod("instapay");
                            }}
                            className={`flex-1 min-w-[70px] py-1.5 px-0.5 text-[9px] font-bold rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                              selectedPaymentMethod === "instapay"
                                ? "bg-orange-50 border-orange-500 text-orange-855 font-extrabold"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-[11px]">📱 إنستاباي</span>
                            <span className="text-[7.5px] text-slate-400 font-normal">بالإثبات 📸</span>
                          </button>
                        )}

                        {restaurant?.allowVodafoneCash !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod("vodafone_cash");
                            }}
                            className={`flex-1 min-w-[70px] py-1.5 px-0.5 text-[9px] font-bold rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                              selectedPaymentMethod === "vodafone_cash"
                                ? "bg-orange-50 border-orange-500 text-orange-855 font-extrabold"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-[11px]">🔴 فودافون كاش</span>
                            <span className="text-[7.5px] text-slate-400 font-normal">بالإثبات 📸</span>
                          </button>
                        )}
                      </div>

                      {/* Payment Screenshot Upload block for cashless flows */}
                      {(selectedPaymentMethod === "instapay" || selectedPaymentMethod === "vodafone_cash") && (
                        <div className="bg-orange-50/40 border border-orange-200/50 rounded-2xl p-3 space-y-2 mt-2 animate-fade-in text-right">
                          <p className="text-[10px] text-orange-850 font-extrabold leading-relaxed">
                            ⚠️ إرشادات التحويل: يرجى تحويل المبلغ المطلوب قدره <span className="underline font-sans font-black">{getTotalPrice().toFixed(2)} ج.م</span> إلى رقم فودافون كاش / إنستاباي للمطعم: <span className="font-mono text-orange-600 bg-white px-1.5 py-0.5 rounded border text-xs">{restaurant?.phone}</span> ثم قم برفع لقطة شاشة (Screenshot) التحويل لإتمام قبول طلبك.
                          </p>
                          
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-700">ارفع لقطة شاشة التحويل الناجح *</label>
                            
                            <div className="border-2 border-dashed border-orange-200 rounded-xl p-3 bg-white text-center cursor-pointer hover:bg-orange-50/20 transition relative">
                              <input
                                type="file"
                                accept="image/*"
                                required
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 2 * 1024 * 1024) {
                                      showToastMessage("حجم الصورة كبير جداً! يرجى اختيار لقطة شاشة بحجم أقل من 2 ميغابايت.", "error");
                                      return;
                                    }
                                    setIsUploadingScreenshot(true);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setPaymentScreenshot(reader.result as string);
                                      setIsUploadingScreenshot(false);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              
                              {paymentScreenshot ? (
                                <div className="space-y-2 relative z-20">
                                  <div className="text-emerald-600 text-xs font-black flex items-center justify-center gap-1">
                                    <span>✓ تم رفع لقطة الشاشة بنجاح</span>
                                  </div>
                                  <img 
                                    src={paymentScreenshot} 
                                    alt="Receipt Preview" 
                                    className="max-h-24 mx-auto rounded-lg border object-contain"
                                  />
                                  <span className="text-[9px] text-slate-400 block underline">انقر مجدداً لتغيير الصورة</span>
                                </div>
                              ) : (
                                <div className="space-y-1 text-slate-500">
                                  <div className="text-lg">📸</div>
                                  <span className="block text-[10px] font-bold text-slate-700">{isUploadingScreenshot ? "جاري قراءة صورة الإثبات..." : "اضغط هنا لاختيار لقطة الشاشة"}</span>
                                  <span className="block text-[8px] text-slate-400">يدعم الصور بحجم أقل من 2 ميغابايت</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isUploadingScreenshot || !getRestaurantOpenStatus()?.isOpenNow}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-lg mt-4 transition"
                    >
                      {!getRestaurantOpenStatus()?.isOpenNow 
                        ? `عذراً، استقبال الطلبات مغلق حالياً 🔒`
                        : isUploadingScreenshot 
                        ? "جاري تجهيز الصورة الإثباتية..." 
                        : `إرسال الطلب للمطبخ فورا وتجهيزة (${getTotalPrice().toFixed(2)} ج.م)`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVE SUBMITTED ORDERS TRACKER */}
          {activeTab === "orders" && (
            <div className="p-4 space-y-5 animate-fade-in pb-16">
              <h2 className="font-extrabold text-slate-900 border-b pb-2 text-sm flex items-center gap-1.5 justify-end">
                <span>تتبع أوردر المطبخ</span>
                <Receipt className="w-4 h-4 text-orange-500" />
              </h2>

              {/* Previous orders selection list */}
              {historyOrders.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl border text-right">
                  <span className="text-[11px] font-black text-slate-700 flex items-center justify-end gap-1 mb-2">
                    <span>طلباتي السابقة والنشطة 🕒</span>
                    <History className="w-3.5 h-3.5 text-orange-500" />
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-205">
                    {historyOrders.map((ord) => {
                      let statusText = "قيد الإنتظار";
                      let statusColor = "bg-orange-100/80 text-orange-850";
                      if (ord.status === "preparing") { statusText = "قيد التحضير"; statusColor = "bg-yellow-105 text-yellow-800"; }
                      else if (ord.status === "ready") { statusText = "جاهز"; statusColor = "bg-blue-105 text-blue-800"; }
                      else if (ord.status === "completed") { statusText = "مكتمل"; statusColor = "bg-green-105 text-green-800"; }
                      else if (ord.status === "cancelled") { statusText = "ملغي"; statusColor = "bg-red-105 text-red-800"; }

                      const isSelected = selectedTrackOrderId === ord.id;
                      
                      return (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => setSelectedTrackOrderId(ord.id)}
                          className={`p-2.5 rounded-xl border shrink-0 text-right text-xs transition duration-150 cursor-pointer ${
                            isSelected 
                              ? "bg-white border-orange-500 ring-2 ring-orange-500/20 shadow-xs font-blackScale" 
                              : "bg-white hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="font-extrabold text-slate-900">{ord.dailyOrderNumber ? `طلب ${ord.dailyOrderNumber}` : `طلب #${ord.id.substring(0, 8)}`}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(ord.createdAt).toLocaleDateString('ar-EG', {month:'short', day:'numeric'})} {new Date(ord.createdAt).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                          </div>
                          <div className="flex justify-between items-center gap-4 mt-1.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${statusColor}`}>{statusText}</span>
                            <span className="font-bold text-slate-800">{ord.totalPrice.toFixed(0)} ج.م</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedTrackOrderId && trackedOrder ? (
                <div className="space-y-5 text-right">
                  {/* Status Card Banner */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                    <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide">
                      جاري المتابعة الحية من السيرفر
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-xs pt-1">
                      طلبك التعريفي: {trackedOrder.dailyOrderNumber || `#${selectedTrackOrderId.substring(0, 8)}`}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      تتغير الحالة فور قيام رئيس الطهاة بتحديثها
                    </p>
                  </div>

                  {/* Web Notification Permission Prompt Widget */}
                  {typeof window !== "undefined" && "Notification" in window && notificationPermission !== "granted" && (
                    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 p-4 rounded-2xl flex flex-col items-center justify-between gap-3 text-center">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5 justify-center">
                          <span>تنبيهات حالة الطلب المباشرة 📡📲</span>
                          <Bell className="w-4 h-4 text-orange-600 animate-bounce" />
                        </h4>
                        <p className="text-[10px] text-amber-900 leading-normal font-medium">
                          فعل الإشعارات في الموبايل أو المتصفح ليصلك تنبيه صوتي فوري بمجرد أن تصبح وجبتك جاهزة!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={requestNotificationPermissions}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[10px] py-1.5 px-3.5 rounded-xl cursor-pointer shadow-sm hover:shadow active:scale-[0.98] transition"
                      >
                        {notificationPermission === "denied" ? "⚠️ تفعيل الإشعارات من إعدادات الموقع" : "تفعيل الإشعارات الفورية بموبايلي 📡"}
                      </button>
                    </div>
                  )}

                  {/* Progressive Stepper UI */}
                  <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border">
                    <span className="text-[10.5px] font-black text-slate-800 block border-b pb-1">مراحل إعداد الوجبة</span>
                    
                    {trackedOrder.status === "cancelled" ? (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-right space-y-1.5 animate-fade-in">
                        <div className="flex items-center gap-1.5 text-red-700 font-extrabold text-xs">
                          <AlertOctagon className="w-4 h-4 shrink-0 text-red-600" />
                          <span>❌ تم إلغاء هذا الطلب</span>
                        </div>
                        {trackedOrder.cancelReason && (
                          <div className="text-[11px] text-red-800 leading-normal font-medium bg-white/40 p-2.5 rounded-xl border border-red-100">
                            <strong>السبب المسجل للمطبخ:</strong> {trackedOrder.cancelReason}
                          </div>
                        )}
                        <p className="text-[10px] text-red-500 font-bold">
                          المبادر بالإلغاء: {trackedOrder.cancelledBy === "owner" ? "👨‍🍳 إدارة مطبخ المطعم" : "👤 أنت (العميل)"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2 text-xs">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`${trackedOrder.status === "pending" ? "text-orange-600 font-black underline" : "text-slate-400"}`}>
                            قيد الاستقبال والموافقة 📋
                          </span>
                          <span className={`h-2 w-2 rounded-full ${trackedOrder.status === "pending" ? "bg-orange-600 animate-ping" : "bg-slate-300"}`} />
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <span className={`${trackedOrder.status === "preparing" ? "text-yellow-600 font-black underline" : "text-slate-400"}`}>
                            تحضير الوجبة المطبخ 🔥
                          </span>
                          <span className={`h-2 w-2 rounded-full ${trackedOrder.status === "preparing" ? "bg-yellow-500 animate-ping" : "bg-slate-300"}`} />
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <span className={`${trackedOrder.status === "ready" ? "text-blue-600 font-black underline" : "text-slate-400"}`}>
                            جاهز للتسليم أو الدليفري 📦
                          </span>
                          <span className={`h-2 w-2 rounded-full ${trackedOrder.status === "ready" ? "bg-blue-500 animate-ping" : "bg-slate-300"}`} />
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <span className={`${trackedOrder.status === "completed" ? "text-green-600 font-black underline" : "text-slate-400"}`}>
                            اكتمل وتم التسليم بالهناء والشفاء 🎉
                          </span>
                          <span className={`h-2 w-2 rounded-full ${trackedOrder.status === "completed" ? "bg-green-600" : "bg-slate-300"}`} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Live Delivery Map Tracking */}
                  {trackedOrder.orderType === "delivery" && (
                    <div className="mt-2">
                      <LiveDeliveryMap order={trackedOrder} role="customer" />
                    </div>
                  )}

                  {/* Countdown Timer for Pending Orders */}
                  {trackedOrder.status === "pending" && (() => {
                    const maxWaitMins = restaurant?.maxAcceptanceWaitMinutes || 15;
                    const elapsedSeconds = Math.floor((Date.now() - new Date(trackedOrder.createdAt).getTime()) / 1000);
                    const remainingSeconds = Math.max(0, (maxWaitMins * 60) - elapsedSeconds);
                    const progressPercentage = Math.max(0, Math.min(100, (remainingSeconds / (maxWaitMins * 60)) * 100));

                    const minStr = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
                    const secStr = (remainingSeconds % 60).toString().padStart(2, "0");

                    return (
                      <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-3xl text-center space-y-3.5 animate-fade-in text-right mb-4" dir="rtl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm">⏳</span>
                            <span>جاري مراجعة وقبول طلبك من المطبخ</span>
                          </div>
                          <span className="text-[10px] bg-amber-200/50 text-amber-800 font-black px-2.5 py-0.5 rounded-full">
                            بانتظار الموافقة
                          </span>
                        </div>

                        {remainingSeconds > 0 ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-500 font-bold">وقت المراجعة التقديري الأقصى:</span>
                              <span className="text-xs font-mono font-black text-amber-700">{minStr}:{secStr} دقيقة</span>
                            </div>
                            {/* Animated clean progress bar */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/40">
                              <div 
                                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-1000 ease-linear"
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold leading-normal">
                              سيتم رنين إنذار المطبخ وتنبيه شيف المطعم فوراً لتأكيد طلبك وتجهيزه بأعلى جودة.
                            </p>
                          </div>
                        ) : (
                          <div className="text-center p-2.5 bg-rose-50 border border-rose-100 rounded-2xl">
                            <p className="text-xs font-black text-rose-800">تأخر قبول الطلب عن المعتاد ⏱️</p>
                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                              المطعم يواجه ضغطاً خفيفاً حالياً، يمكنك الاتصال المباشر بالمطعم عبر الهاتف أو زر الواتساب للتأكيد الفوري!
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Delayed order alert in Arabic (Kitchen SLA exceeded) */}
                  {(() => {
                    if (trackedOrder.status === "pending" || trackedOrder.status === "preparing") {
                      const elapsedMinutes = Math.floor((new Date().getTime() - new Date(trackedOrder.createdAt).getTime()) / 60000);
                      const targetTime = restaurant?.targetPrepTimeMinutes || 30;
                      if (elapsedMinutes > targetTime) {
                        return (
                          <div className="bg-amber-50/80 border-r-4 border-amber-500 p-3 rounded-2xl text-right flex items-start gap-2.5 animate-pulse mt-1 mb-1 shadow-2xs">
                            <span className="text-amber-500 text-lg shrink-0">🍳</span>
                            <div className="space-y-0.5">
                              <p className="text-[11px] font-black text-amber-900">نعتذر بشدة لتأخر الطلب! 🙏</p>
                              <p className="text-[9.5px] text-amber-850 leading-normal font-semibold">
                                فريقنا يقوم بتحضير وجبتك بكل حب وبسرعة قصوى حالياً بمطبخنا، نعدك بتقديم غلّاف وجودة ممتازة في أقرب دقيقة!
                              </p>
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

                  {/* Summary of invoice items */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border space-y-2 text-xs">
                    <span className="text-[10.5px] font-black text-slate-800 block border-b pb-1">الفاتورة الموجهة</span>
                    {trackedOrder.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-slate-700">
                        <span>{(it.price * it.quantity).toFixed(2)} ج.م</span>
                        <span>{it.name} × {it.quantity}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-black text-sm text-slate-900">
                      <span className="text-orange-600 font-bold">{trackedOrder.totalPrice.toFixed(2)} ج.م</span>
                      <span>الإجمالي المؤكد:</span>
                    </div>
                  </div>

                  {/* Customer Rating & Stars Feedbacks Block */}
                  {trackedOrder.status === "completed" && (
                    <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-200/60 space-y-4 text-right">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] bg-orange-100 text-orange-950 px-2.5 py-0.5 rounded-full font-extrabold inline-block">
                          رأي عميلنا يهمنا جداً 🌟
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900 pt-1">
                          تقييم الوجبات وجودة التوصيل والخدمة
                        </h4>
                        <p className="text-[9.5px] text-slate-500 leading-normal">
                          مشاركتك لتقييم إيجابي أو سلبي تساعدنا في تحسين وتجهيز طلباتك ومتحف الأطباق لدينا!
                        </p>
                      </div>

                      {/* Stars Row */}
                      <div className="flex items-center justify-center gap-1.5" dir="ltr">
                        {[1, 2, 3, 4, 5].map((starValue) => {
                          const isLit = (hoveredRating || selectedRating) >= starValue;
                          return (
                            <button
                              key={starValue}
                              type="button"
                              onClick={() => {
                                if (trackedOrder.rating) return; // Prevent changing if already submitted
                                setSelectedRating(starValue);
                              }}
                              onMouseEnter={() => {
                                if (trackedOrder.rating) return;
                                setHoveredRating(starValue);
                              }}
                              onMouseLeave={() => {
                                if (trackedOrder.rating) return;
                                setHoveredRating(0);
                              }}
                              className={`p-1 transition duration-150 transform hover:scale-110 active:scale-95 ${
                                trackedOrder.rating ? "cursor-default" : "cursor-pointer"
                              }`}
                            >
                              <Star
                                className={`w-7 h-7 ${
                                  isLit
                                    ? "fill-amber-400 text-amber-400 filter drop-shadow-[0_1px_2px_rgba(251,191,36,0.3)]"
                                    : "text-slate-300"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Comment Input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-700">اترك تعليقك أو أي ملاحظة تهمنا:</label>
                        {trackedOrder.rating ? (
                          <div className="bg-white p-3 rounded-xl border text-xs text-slate-800 font-medium">
                            {trackedOrder.reviewComment || <span className="text-slate-400 italic">تم إرسال التقييم بدون مراجعة نصية.</span>}
                          </div>
                        ) : (
                          <textarea
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="مثال: الطعام شهي جداً والتوصيل كان سريعاً، شكراً لكم!"
                            className="w-full text-xs border rounded-xl py-2 px-3 focus:border-orange-500 focus:outline-none bg-white min-h-16 resize-none font-medium text-slate-800"
                            maxLength={300}
                          />
                        )}
                      </div>

                      {/* Submission button (only if not rated yet) */}
                      {!trackedOrder.rating ? (
                        <button
                          type="button"
                          onClick={handleRatingSubmit}
                          disabled={submittingRating || selectedRating === 0}
                          className="w-full text-center py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingRating ? "جاري تسليم تقييمك..." : "إرسال التقييم والمراجعة ⚡"}
                        </button>
                      ) : (
                        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-2.5 text-center text-[10.5px] font-bold">
                          تم استلام تقييمك بنجاح! شكرًا لك لوقتك. 🌸
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real-time chat with the Cafe / Restaurant Owner */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-4.5 space-y-3.5 text-right shadow-xs">
                    <h3 className="font-extrabold text-[12px] text-indigo-950 flex items-center gap-1.5 justify-end">
                      <span>الدردشة الحية والمباشرة مع المطبخ 💬</span>
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                    </h3>
                    <p className="text-[10px] text-slate-400">تواصل غرضًا أو استفسر عن الطلب، الدلفري، أو أضف ملحوظة فورية بخصوص وجبتك.</p>
                    <OrderChatComponent 
                      orderId={trackedOrder.id} 
                      userId="customer"
                      userName={customerName || trackedOrder.customerName || "الزبون"} 
                      userType="customer"
                    />
                  </div>

                  {/* Customer Cancellation Request Action */}
                  {(trackedOrder.status === "pending" || trackedOrder.status === "preparing") && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelTargetOrderId(trackedOrder.id);
                        setCustomerCancelReason("");
                        setIsCancelModalOpen(true);
                      }}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-2.5 px-4 rounded-xl text-xs border border-red-200 transition duration-150 cursor-pointer text-center"
                    >
                      إلغاء هذا الطلب وكتابة السبب ❌
                    </button>
                  )}

                  <button
                    onClick={() => {
                      saveActiveOrder(null);
                      setTrackedOrder(null);
                    }}
                    className="w-full text-center py-2 text-xs text-slate-400 border border-slate-200 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                  >
                    إلغاء المراقبة الحالية للطلب
                  </button>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 space-y-3">
                  <div className="bg-slate-100 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-slate-400">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-bold font-sans">برجاء اختيار أي طلب من القائمة أعلاه لمتابعته.</p>
                  <p className="text-[10px] max-w-[250px] mx-auto leading-relaxed">
                    يمكنك تتبع كل أوردراتك الحالية، الإلغاء، أو كتابة مراجعات لطلباتك السابقة والمزيد.
                  </p>
                  <button
                    onClick={() => setActiveTab("home")}
                    className="bg-orange-600 text-white text-xs font-bold py-2 px-6 rounded-xl hover:bg-orange-700 font-sans cursor-pointer"
                  >
                    الذهاب لقسم الأطعمة لشراء المزيد
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACCOUNT / PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="p-4 space-y-5 animate-fade-in text-right">
              <h2 className="font-extrabold text-slate-900 border-b pb-2 text-sm flex items-center gap-1.5 justify-end">
                <span>حسابي الشخصي</span>
                <User className="w-4 h-4 text-orange-500" />
              </h2>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mx-auto font-black text-lg shadow-sm">
                    {customerName ? customerName.slice(0, 1) : "ع"}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">{customerName || "عميل فود"}</h3>
                    <p className="text-[10px] text-slate-500">{customerPhone || "برجاء كتابة رقم الهاتف بالأسفل"}</p>
                  </div>
                </div>

                {/* BRAND NEW LUXURY CUSTOMER LOYALTY CARD AND TIER TRACKER */}
                {restaurant?.loyaltyEnabled && (
                  <div className="bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 text-white rounded-3xl p-5 border border-orange-500/10 shadow-xl space-y-4 text-right overflow-hidden relative group">
                    {/* Glossy overlay effect */}
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition duration-500"></div>
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition duration-500"></div>
                    
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
                      <span className="text-[9px] font-black tracking-widest text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded border border-orange-500/20">بطاقة ولاء عملاء إسلام فود 👑</span>
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>

                    <div className="flex justify-between items-center relative z-10">
                      <div className="text-left font-mono">
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                          {loyaltyPoints !== null ? loyaltyPoints : 0}
                        </span>
                        <span className="text-[9px] text-slate-350 block">مجموع نقاطك</span>
                      </div>
                      <div>
                        {(() => {
                          const pts = loyaltyPoints || 0;
                          let tierName = "البرونزية 🥞";
                          let tierColor = "from-amber-700 to-amber-600";
                          let nextTierPoints = 50;
                          
                          if (pts >= 150) {
                            tierName = "الذهبية الخارقة 👑";
                            tierColor = "from-amber-400 to-yellow-500";
                            nextTierPoints = 0;
                          } else if (pts >= 50) {
                            tierName = "الفضية الممتازة 🥈";
                            tierColor = "from-slate-300 to-slate-400";
                            nextTierPoints = 150;
                          }

                          const progressPercent = nextTierPoints > 0 ? Math.min(100, (pts / nextTierPoints) * 100) : 100;

                          return (
                            <div className="space-y-1 text-right">
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r ${tierColor} text-white inline-block`}>
                                الفئة: {tierName}
                              </span>
                              {nextTierPoints > 0 ? (
                                <p className="text-[8.5px] text-slate-350">
                                  باقي {nextTierPoints - pts} نقطة لترقية فئتك!
                                </p>
                              ) : (
                                <p className="text-[8.5px] text-amber-400">لقد وصلت للحد الذهبي الأقصى للولاء! خصومات هائلة فادحة 🔥</p>
                              )}

                              {/* Progress Bar */}
                              <div className="w-32 bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 relative z-10">
                      <span>رقم الهاتف المعتمر: {customerPhone || "طلب التسجيل بالأسفل"}</span>
                      <span>قيمة النقطة: {(restaurant?.pointValueEgp || 0.05)} ج.م</span>
                    </div>
                  </div>
                )}

                {/* إعدادات وتخصيص مظهر التطبيق واللغة */}
                <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-150 shadow-sm text-xs text-right">
                  <span className="text-[10px] font-black text-slate-500 block border-b pb-1.5 mb-2.5 uppercase">⚙️ {t.themeLabel || "تخصيص وإعدادات التطبيق"}</span>
                  
                  {/* Language Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-500">🌍 {t.languageLabel || "لغة التطبيق / Language"}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAppLanguage('ar');
                          localStorage.setItem("islamfood_language", "ar");
                          showToastMessage("تم تحويل لغة التطبيق إلى العربية 🇪🇬", "success");
                        }}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black border text-center transition cursor-pointer ${
                          appLanguage === 'ar'
                            ? 'bg-orange-600 text-white border-orange-600 font-extrabold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        العربية 🇪🇬
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAppLanguage('en');
                          localStorage.setItem("islamfood_language", "en");
                          showToastMessage("Application language set to English 🇬🇧", "success");
                        }}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black border text-center transition cursor-pointer ${
                          appLanguage === 'en'
                            ? 'bg-orange-600 text-white border-orange-600 font-extrabold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        English 🇬🇧
                      </button>
                    </div>
                  </div>

                  {/* Dark Mode Selector */}
                  <div className="space-y-1.5 pt-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-500">🎨 {t.themeLabel || "مظهر وألوان التطبيق / Theme"}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode('light');
                          localStorage.setItem("islamfood_theme_mode", "light");
                          showToastMessage(appLanguage === 'ar' ? "تم تفعيل الوضع الفاتح بنجاح ☀️" : "Light theme activated successfully ☀️", "success");
                        }}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black border text-center transition cursor-pointer ${
                          themeMode === 'light'
                            ? 'bg-orange-600 text-white border-orange-600 font-extrabold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.themeLight || "الوضع الفاتح ☀️"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode('dark');
                          localStorage.setItem("islamfood_theme_mode", "dark");
                          showToastMessage(appLanguage === 'ar' ? "تم تفعيل الوضع الداكن بنجاح 🌙" : "Dark theme activated successfully 🌙", "success");
                        }}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black border text-center transition cursor-pointer ${
                          themeMode === 'dark'
                            ? 'bg-orange-600 text-white border-orange-600 font-extrabold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.themeDark || "الوضع الداكن 🌙"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-xs">
                  <span className="text-[10px] font-black text-slate-500 block border-b pb-1.5 mb-2.5 uppercase">{t.changeProfile || "تحديث الملف الشخصي"}</span>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">{t.fullName || "الاسم بالكامل"}</label>
                      <input
                        type="text"
                        placeholder={appLanguage === 'ar' ? "أدخل اسمك الكريم" : "Enter your full name"}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">{t.phone || "رقم الهاتف"}</label>
                        <input
                          type="tel"
                          placeholder="Example: 01012356"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">{t.age || "العمر / السن"}</label>
                        <input
                          type="number"
                          placeholder="Example: 25"
                          value={customerAge}
                          onChange={(e) => setCustomerAge(e.target.value)}
                          className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">{t.fullAddress || "العنوان والشارع بالكامل"}</label>
                      <input
                        type="text"
                        placeholder={appLanguage === 'ar' ? "أدخل الشارع، المنطقة، رقم العقار والتوصيل" : "Enter street address and apartment number"}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const prof = {
                          name: customerName,
                          phone: customerPhone,
                          age: customerAge,
                          governorate: customerGovernorate,
                          street: customerStreet,
                          address: deliveryAddress
                        };
                        localStorage.setItem("user_profile", JSON.stringify(prof));
                        showToastMessage(appLanguage === 'ar' ? "تم تحديث وحفظ بيانات ملفك الشخصي محلياً بنجاح!" : "Profile details saved successfully!", "success");
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer"
                    >
                      {t.saveChanges || "حفظ التغييرات"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Smartphone Floating AI Support chatbot in bottom corner */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none z-40">
          <div className="absolute bottom-0 left-4 pointer-events-auto">
            {showChat ? (
              <div 
                className="absolute bottom-2 left-0 bg-white rounded-3xl w-[280px] sm:w-[320px] h-[360px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-right animate-slide-up"
                style={{ fontFamily: globalSettings?.platformFontFamily || "inherit" }}
              >
                {/* Header */}
                <div 
                  className="text-white p-3.5 flex items-center justify-between shadow-sm"
                  style={{ backgroundColor: globalSettings?.chatBubbleColor || "#fa5a00" }}
                >
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-white/85 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <h4 className="text-[12px] font-black tracking-wide">المساعد الذكي الفوري 🤖</h4>
                      <p className="text-[9px] text-white/80 font-bold font-sans">بوابة إسلام فود للذكاء الاصطناعي</p>
                    </div>
                    <div className="bg-white/20 p-1.5 rounded-full shadow-inner">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Chat Message List */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/50">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div 
                        className={`max-w-[88%] rounded-2xl p-3 text-[11.5px] sm:text-[12.5px] font-black leading-relaxed shadow-xs ${
                          msg.role === 'user'
                            ? 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                            : 'rounded-tr-none shadow-sm'
                        }`}
                        style={msg.role === 'model' ? {
                          backgroundColor: globalSettings?.chatBubbleColor || "#fa5a00",
                          color: globalSettings?.chatTextColor || "#ffffff"
                        } : { fontSize: globalSettings?.platformFontSize || "inherit" }}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {sendingMsg && (
                    <div className="flex justify-end animate-pulse">
                      <div className="bg-orange-100 text-orange-950 border border-orange-200/60 rounded-2xl rounded-tr-none p-2.5 text-[10px] font-black flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-orange-600 animate-spin" />
                        <span>جاري معالجة سؤالك بدقة...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sending form */}
                <form onSubmit={handleSendChatMessage} className="p-2 border-t border-slate-100 bg-white flex gap-1.5">
                  <button
                    type="submit"
                    disabled={sendingMsg || !newMessage.trim()}
                    className="disabled:bg-slate-200 text-white font-black px-4 py-2 rounded-xl text-xs transition shrink-0 shadow-sm cursor-pointer"
                    style={{ backgroundColor: sendingMsg || !newMessage.trim() ? undefined : (globalSettings?.chatBubbleColor || "#fa5a00") }}
                  >
                    أرسل
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="اسأل عن الوجبات أو الفروع..."
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 text-right focus:outline-none placeholder-slate-400"
                    style={{ fontSize: globalSettings?.platformFontSize || "inherit" }}
                  />
                </form>
              </div>
            ) : (
              <button
                onClick={() => setShowChat(true)}
                className="bg-orange-600 text-white rounded-full p-3 hover:bg-orange-700 hover:scale-105 active:scale-95 shadow-xl transition border border-white cursor-pointer"
                title="تواصل مع المساعد الذكي"
              >
                <Sparkles className="w-4 h-4 animate-pulse text-yellow-300" />
              </button>
            )}
          </div>
        </div>

        {/* STICKY BOTTOM NAVIGATION BAR SPREAD EVENLY MATCHING THE USER DECOR */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] h-[68px] pb-safe flex items-center justify-around px-2 z-40 rounded-t-3xl">
          
          {/* Account Tab */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 cursor-pointer ${
              activeTab === "profile" ? "text-orange-600 scale-105 font-black" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <User className="w-4.5 h-4.5 mb-1" />
            <span className="text-[10px]">حسابي</span>
          </button>

          {/* Orders Tracker Tab */}
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 cursor-pointer relative ${
              activeTab === "orders" ? "text-orange-600 scale-105 font-black" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className="relative">
              <Receipt className="w-4.5 h-4.5 mb-1" />
              {activeOrderId && (
                <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-white"></span>
              )}
            </div>
            <span className="text-[10px]">طلباتي</span>
          </button>

          {/* Cart Tab */}
          <button
            onClick={() => setActiveTab("cart")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 cursor-pointer relative ${
              activeTab === "cart" ? "text-orange-600 scale-105 font-black" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="w-4.5 h-4.5 mb-1" />
              {totalCartItemsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-orange-600 text-white text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center animate-bounce">
                  {totalCartItemsCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">السلة</span>
          </button>

          {/* Home Tab */}
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 cursor-pointer ${
              activeTab === "home" ? "text-orange-600 scale-105 font-black" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Home className="w-4.5 h-4.5 mb-1" />
            <span className="text-[10px]">الرئيسية</span>
          </button>

        </div>

        {/* Custom Cancellation overlay modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-right" dir="rtl">
            <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-950 text-base flex items-center gap-2">
                  <span className="p-1 w-7 h-7 bg-red-50 text-red-650 rounded-lg flex items-center justify-center font-bold text-sm">⚠️</span>
                  إلغاء طلب الوجبات
                </h3>
                <button 
                  onClick={() => { setIsCancelModalOpen(false); setCancelTargetOrderId(null); }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed font-semibold">
                  يرجى تزويد المطبخ بسبب إلغاء الطلب لتحديثه وتوثيقه لديهم قبل إلغاء التجهيز:
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">لماذا تريد إلغاء الطلب؟ *</label>
                  <textarea
                    required
                    value={customerCancelReason}
                    onChange={(e) => setCustomerCancelReason(e.target.value)}
                    placeholder="مثال: اخترت عنوان قاسي بالخطأ، أو أريد طلب أطباق أخرى بدلاً..."
                    className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-red-500 bg-slate-50 min-h-20 resize-none font-medium text-slate-850"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCancelModalOpen(false); setCancelTargetOrderId(null); }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-850 font-bold py-2.5 rounded-xl transition text-xs text-center cursor-pointer"
                >
                  تراجع وإبقاء الطلب
                </button>
                <button
                  type="button"
                  onClick={handleCustomerCancelOrder}
                  disabled={isCancellingOrder || !customerCancelReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition text-xs text-center cursor-pointer disabled:opacity-50"
                >
                  {isCancellingOrder ? "جاري الإلغاء..." : "تأكيد إلغاء الطلب ⚡"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Promotion Advertisement Modal */}
        {showAdPopup && activeAdvertisement && (
          <div className="fixed inset-0 bg-slate-950/98 z-[250] flex flex-col items-center justify-center p-0 md:p-4 select-none animate-fade-in" dir="rtl">
            <div className="relative w-full h-full md:max-w-md md:h-[90vh] md:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between">
              
              {/* Ad Image Container with Zoom and Fit mode */}
              <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden z-0 bg-black">
                <img 
                  src={activeAdvertisement.mediaUrl} 
                  alt="Promotion" 
                  className="transition-transform duration-200 ease-out" 
                  style={{
                    transform: `scale(${adZoomScale})`,
                    objectFit: adFitMode,
                    width: '100%',
                    height: '100%'
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Floating Header with Badge and SKIP BUTTON */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 p-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/5">
                <span className="bg-orange-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full animate-pulse">
                  إعلان ممول 🔥
                </span>
                <button 
                  onClick={() => {
                    sessionStorage.setItem("islamfood_ad_skipped_" + activeAdvertisement.id, "true");
                    setShowAdPopup(false);
                  }}
                  className="bg-white text-slate-950 hover:bg-orange-600 hover:text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1 shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <span>تخطي الإعلان</span>
                  <span className="text-sm">⏭️</span>
                </button>
              </div>

              {/* Custom Overlay Text */}
              {activeAdvertisement.text && (
                <div 
                  className="absolute left-4 right-4 p-4 rounded-2xl text-center font-extrabold shadow-lg border border-white/5 break-words z-10"
                  style={{
                    backgroundColor: activeAdvertisement.textBg || "rgba(0,0,0,0.6)",
                    color: activeAdvertisement.textColor || "#ffffff",
                    top: activeAdvertisement.textPosition === "top" ? "80px" : activeAdvertisement.textPosition === "center" ? "50%" : "auto",
                    bottom: activeAdvertisement.textPosition === "bottom" ? "145px" : "auto", // Clears the controls toolbar
                    transform: activeAdvertisement.textPosition === "center" ? "translateY(-50%)" : "none",
                    fontSize: activeAdvertisement.textSize === "xs" ? "12px" :
                              activeAdvertisement.textSize === "sm" ? "14px" :
                              activeAdvertisement.textSize === "base" ? "16px" :
                              activeAdvertisement.textSize === "lg" ? "18px" : "22px"
                  }}
                >
                  {activeAdvertisement.text}
                </div>
              )}

              {/* Responsive Zoom & Fit Info (Applied from Admin Panel) & Customer Reply Form */}
              <div className="absolute bottom-4 left-4 right-4 z-30 p-3 bg-black/85 backdrop-blur-lg rounded-2xl border border-white/10 flex flex-col gap-2 shadow-2xl">
                {/* Send Reply Form */}
                <form onSubmit={handleSendAdReply} className="flex gap-1.5 mt-1">
                  <input
                    type="text"
                    value={adReplyText}
                    onChange={(e) => setAdReplyText(e.target.value)}
                    placeholder="اكتب ردّك أو استفسارك هنا لصاحب المطعم... 💬"
                    className="flex-grow bg-white/10 text-white rounded-xl px-3 py-2 text-[11px] outline-none border border-white/15 focus:border-orange-500 transition placeholder-white/30"
                  />
                  <button
                    type="submit"
                    disabled={isSendingAdReply || !adReplyText.trim()}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 text-white px-3 py-2 rounded-xl transition active:scale-95 text-[11px] font-bold flex items-center gap-1 shrink-0"
                  >
                    {isSendingAdReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>إرسال 🚀</span>}
                  </button>
                </form>

                <p className="text-[9px] text-slate-400 text-center leading-normal">
                  أبعاد عرض وزووم هذا الإعلان يتم ضبطها وتعديلها تلقائياً من لوحة الإدارة العامة لضمان مظهر مثالي لجميع الزوار.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Item Customize & Specifications Modal Dialog */}
        {selectedItemForModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-orange-100 flex flex-col max-h-[90vh]">
              
              {/* Header Image */}
              <div className="relative w-full h-56 sm:h-64 bg-slate-100 shrink-0">
                {selectedItemForModal.image ? (
                  <img 
                    src={selectedItemForModal.image} 
                    alt={selectedItemForModal.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-100/30 to-amber-100/30 text-orange-600 flex flex-col items-center justify-center">
                    <ChefHat className="w-16 h-16 text-orange-500 stroke-[1.5]" />
                    <span className="text-xs font-bold mt-2">طعام طازج ولذيذ ✨</span>
                  </div>
                )}
                
                {/* Floating Close button */}
                <button 
                  onClick={() => setSelectedItemForModal(null)}
                  className="absolute top-4 right-4 bg-black/45 hover:bg-black/60 text-white rounded-full p-2.5 shadow-lg backdrop-blur-xs transition cursor-pointer"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Offer tag */}
                {selectedItemForModal.originalPrice && selectedItemForModal.originalPrice > selectedItemForModal.price && (
                  <div className="absolute bottom-4 right-4 bg-red-650 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1">
                    <span>عرض حصري خصم {Math.round(((selectedItemForModal.originalPrice - selectedItemForModal.price) / selectedItemForModal.originalPrice) * 100)}% 🔥</span>
                  </div>
                )}
              </div>

              {/* Scrollable specs & custom options list */}
              <div className="flex-1 p-5 overflow-y-auto space-y-5 text-right no-scrollbar">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{selectedItemForModal.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">التصنيف: {selectedItemForModal.category}</p>
                </div>

                {/* Description & Specs */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-1.5 text-right">
                  <h4 className="font-extrabold text-[11px] text-slate-500 leading-none">مواصفات ومكونات الوجبة 🍽️</h4>
                  <p className="text-slate-800 text-xs font-bold leading-relaxed">
                    {selectedItemForModal.description || "هذه الوجبة اللذيذة محضرة من أفضل المكونات الطازجة بعناية فائقة وخلطة سرية خاصة لتمنحك مذاقاً غنياً لا ينسى."}
                  </p>
                </div>

                {/* Item custom options selection checklist */}
                {selectedItemForModal.options && selectedItemForModal.options.length > 0 && (
                  <div className="space-y-2.5 text-right">
                    <div className="flex items-center gap-1.5 justify-start">
                      <Sparkles className="w-4 h-4 text-orange-500 fill-orange-500" />
                      <h4 className="font-extrabold text-xs text-slate-800">إضافات وخيارات الوجبة الإضافية (اختياري)</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {selectedItemForModal.options.map((opt: { name: string; price: number }) => {
                        const isChecked = itemModalSelectedOptions.some(o => o.name === opt.name);
                        return (
                          <div 
                            key={opt.name}
                            onClick={() => {
                              if (isChecked) {
                                setItemModalSelectedOptions(itemModalSelectedOptions.filter(o => o.name !== opt.name));
                              } else {
                                setItemModalSelectedOptions([...itemModalSelectedOptions, opt]);
                              }
                            }}
                            className={`flex items-center justify-between p-3 rounded-2xl border transition duration-150 cursor-pointer ${
                              isChecked 
                                ? "bg-orange-50/70 border-orange-500/80 text-orange-950" 
                                : "bg-white border-slate-200/70 text-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                isChecked ? "bg-orange-600 border-orange-600 text-white" : "border-slate-300 bg-slate-50"
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                              </div>
                              <span className="text-xs font-black">{opt.name}</span>
                            </div>
                            <span className="text-xs font-black font-sans text-orange-600">+{opt.price.toFixed(0)} ج.م</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes Input Field during order */}
                <div className="space-y-2 text-right">
                  <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 justify-start">
                    <span>ملاحظات خاصة على الوجبة 📝</span>
                  </h4>
                  <textarea
                    rows={2}
                    value={itemModalNotes}
                    onChange={(e) => setItemModalNotes(e.target.value)}
                    placeholder="مثال: بدون بصل، زيادة صوص كاتشب، تسوية زيادة..."
                    className="w-full text-xs font-bold border border-slate-200 rounded-2xl p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition duration-150 text-right bg-slate-50"
                  />
                </div>
              </div>

              {/* Sticky bottom Action Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 shrink-0 rounded-b-3xl">
                {/* Quantity controller */}
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
                  <button
                    onClick={() => setItemModalQuantity(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-extrabold flex items-center justify-center transition"
                  >
                    <Minus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <span className="text-sm font-black font-sans text-slate-950 min-w-[20px] text-center">
                    {itemModalQuantity}
                  </span>
                  <button
                    onClick={() => setItemModalQuantity(prev => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-extrabold flex items-center justify-center transition"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Confirm and Add Button */}
                <button
                  onClick={() => {
                    addToCart(selectedItemForModal, itemModalSelectedOptions, itemModalNotes, itemModalQuantity);
                    setSelectedItemForModal(null);
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-6 rounded-2xl shadow-lg shadow-orange-600/15 transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>إضافة للسلة 🛍️</span>
                  <span className="font-sans text-[11px] opacity-80">
                    ({((selectedItemForModal.price + itemModalSelectedOptions.reduce((sum, o) => sum + o.price, 0)) * itemModalQuantity).toFixed(0)} ج.م)
                  </span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Global Floating Technical Support chat helpdesk for Customers */}
        {restaurant?.id && (
          <TechSupportChatWidget
            userId={`customer_${restaurant.id}_${Math.random().toString(36).substring(2, 9)}`}
            userName={customerName || "زبون زائر للمنيو 👤"}
            userType="customer"
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
          />
        )}

      </div>
    </div>
  );
}
