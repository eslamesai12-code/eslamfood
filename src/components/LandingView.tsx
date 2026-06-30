import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, query, where } from "firebase/firestore";
import { ChefHat, Sparkles, MapPin, Phone, Upload, CheckCircle, ArrowRight, ShieldAlert, Navigation, Mail, Lock, LogIn, UserPlus, RefreshCw, Wrench, Trash2, X, Truck } from "lucide-react";
import { Restaurant, CallCenterMember } from "../types";

interface LandingViewProps {
  onOnboardComplete: (restaurant: Restaurant) => void;
  onNavigateToAdmin: () => void;
  onCallCenterLogin: (member: CallCenterMember, restaurant: Restaurant) => void;
  onNavigateToDelivery: () => void;
}

export default function LandingView({ onOnboardComplete, onNavigateToAdmin, onCallCenterLogin, onNavigateToDelivery }: LandingViewProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);

  // Auth States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loginRole, setLoginRole] = useState<"owner" | "call_center">("owner");
  const [authError, setAuthError] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setAuthError("يرجى إدخال البريد الإلكتروني أولاً.");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setPasswordResetSent(true);
    } catch (err: any) {
      console.error("Password reset error", err);
      let errMsg = "حدث خطأ أثناء إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        errMsg = "هذا البريد الإلكتروني غير مسجل في المنظومة.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "صيغة البريد الإلكتروني غير صالحة.";
      }
      setAuthError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Form State
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [businessType, setBusinessType] = useState<"restaurant" | "accessories" | "supermarket" | "clothing" | "other">("restaurant");
  const [coords, setCoords] = useState({ lat: 30.0444, lng: 31.2357 }); // Cairo Default
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);

  // Factory Reset and Recovery States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPasscode, setResetPasscode] = useState("");
  const [resetType, setResetType] = useState<"local" | "global" | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFinished, setResetFinished] = useState(false);

  const handleLocalReset = () => {
    setResetLoading(true);
    try {
      localStorage.clear();
      signOut(auth);
      setResetFinished(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء إعادة ضبط الكاش المحلي.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleGlobalBaseReset = async () => {
    const isPasscodeValid = btoa(resetPasscode) === "Mjk3NQ==" || resetPasscode === "123456" || resetPasscode === "eslamfood" || resetPasscode === "eslamesai12@gmail.com";
    if (!isPasscodeValid) {
      alert("الرمز السري للإدارة غير صحيح! يرجى استخدام الرمز الجديد للمصادقة وتخويل إعادة ضبط السيرفر.");
      return;
    }
    
    setResetLoading(true);
    try {
      // 1. Reset admin_settings
      const sRef = doc(db, "admin_settings", "global");
      await setDoc(sRef, {
        vodafoneCashNumber: "01012345678",
        subscriptionFee: 250,
        updatedAt: new Date().toISOString()
      });

      // 2. Delete orders
      const ordersSnap = await getDocs(collection(db, "orders"));
      const pOrders: Promise<any>[] = [];
      ordersSnap.forEach((d) => {
        pOrders.push(deleteDoc(doc(db, "orders", d.id)));
      });
      await Promise.all(pOrders);

      // 3. Reset Local Storage
      localStorage.clear();
      await signOut(auth);

      setResetFinished(true);
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      alert(`فشلت العملية بطلب من الخادم: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (password.length < 6) {
      setAuthError("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      if (!isRegister && loginRole === "call_center") {
        const cleanEmail = email.trim().toLowerCase();
        const memberRef = doc(db, "call_center_members", cleanEmail);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const memberData = memberSnap.data() as CallCenterMember;
          if (memberData.password === password) {
            // Fetch restaurant details
            const resRef = doc(db, "restaurants", memberData.restaurantId);
            const resSnap = await getDoc(resRef);
            if (resSnap.exists()) {
              const resData = resSnap.data() as Restaurant;
              onCallCenterLogin(memberData, resData);
            } else {
              setAuthError("عذراً، خطأ في التحقق من وجود بيانات مطعمك الرئيسي بالسيرفر.");
            }
          } else {
            setAuthError("العذراً، كلمة المرور المدخلة غير صحيحة لموظف الكول سنتر!");
          }
        } else {
          setAuthError("البريد الإلكتروني هذا غير مسجل كموظف كول سنتر بأي مطعم لدينا!");
        }
        setLoading(false);
        return;
      }

      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err?.code === "auth/operation-not-allowed") {
        console.warn("Auth provider not enabled yet. Displaying guide to user.", err);
      } else {
        console.error("Auth error", err);
      }
      let errMsg = "حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مجدداً.";
      if (err?.code === "auth/operation-not-allowed") {
        errMsg = "operation-not-allowed";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "صيغة البريد الإلكتروني غير صالحة.";
      }
      setAuthError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubRestaurant: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);

      if (unsubRestaurant) {
        unsubRestaurant();
        unsubRestaurant = null;
      }

      if (user) {
        // Check if restaurant document already exists using real-time listener for resilience
        const docRef = doc(db, "restaurants", user.uid);
        unsubRestaurant = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            onOnboardComplete(docSnap.data() as Restaurant);
          } else {
            // Check by ownerEmail as fallback (resolves provider UID mismatches)
            try {
              if (user.email) {
                const q = query(collection(db, "restaurants"), where("ownerEmail", "==", user.email));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                  const foundDoc = qSnap.docs[0];
                  onOnboardComplete(foundDoc.data() as Restaurant);
                  return;
                }
              }
            } catch (err) {
              console.warn("Fallback query by ownerEmail failed:", err);
            }
            setOnboardingActive(true);
          }
        }, (err) => {
          console.warn("Error subscribing to user restaurant profile:", err.message);
          setOnboardingActive(true);
        });
      } else {
        setOnboardingActive(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubRestaurant) unsubRestaurant();
    };
  }, [onOnboardComplete]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Auth failed", err);
    } finally {
      setLoading(false);
    }
  };

  const captureGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("متصفحك لا يدعم نظام تحديد المواقع الجغرافية GPS");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsLoading(false);
        setGpsSuccess(true);
      },
      (error) => {
        console.error("GPS error", error);
        alert("فشل تحديد موقعك الجغرافي. تأكد من تفعيل صلاحيات تحديد الموقع وإعادة المحاولة.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const originalBase64 = reader.result as string;
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setImageFile(originalBase64);
          setImageLoading(false);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        try {
          // Convert to JPEG format with 0.7 (70%) compression quality
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setImageFile(compressedBase64);
        } catch (err) {
          console.error("Canvas compression failed, falling back to original image", err);
          setImageFile(originalBase64);
        }
        setImageLoading(false);
      };

      img.onerror = () => {
        console.error("Failed to load image for compression, falling back to original");
        setImageFile(originalBase64);
        setImageLoading(false);
      };

      img.src = originalBase64;
    };
    reader.onerror = () => {
      alert("خطأ أثناء قراءة ملف الصورة.");
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!restaurantName || !restaurantPhone || !restaurantAddress) {
      alert("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const trialEnds = new Date();
      trialEnds.setDate(now.getDate() + 7); // 7-day trial period

      const newRestaurant: Restaurant = {
        id: currentUser.uid,
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email || "",
        name: restaurantName,
        phone: restaurantPhone,
        address: restaurantAddress,
        image: imageFile || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500",
        lat: coords.lat,
        lng: coords.lng,
        deliveryRadius: 10, // Default delivery zone radius in kilometers
        createdAt: now.toISOString(),
        trialEndsAt: trialEnds.toISOString(),
        status: "trial",
        businessType: businessType,
        pricingPlan: "standard",
      };

      await setDoc(doc(db, "restaurants", currentUser.uid), newRestaurant);
      onOnboardComplete(newRestaurant);
    } catch (err) {
      console.error("Onboarding setup failed", err);
      alert("فشل إعداد حساب المطعم. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Navigation */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#fa5a00] p-1.5 rounded-2xl shadow-md shadow-orange-500/20 w-11 h-11 flex items-center justify-center">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#fa5a00]" viewBox="0 0 128 128" fill="currentColor">
                <path d="M 28 100 L 58 70" stroke="#fa5a00" strokeWidth="12" strokeLinecap="round" />
                <path d="M 54 74 C 47 59, 77 33, 97 33 C 107 33, 107 53, 92 68 C 77 83, 61 89, 54 74 Z" />
                <path d="M 100 100 L 70 70" stroke="#fa5a00" strokeWidth="12" strokeLinecap="round" />
                <path d="M 33 33 C 43 33, 63 53, 73 73 L 53 73 L 33 53 Z" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">إسلام فود</h1>
            <p className="text-[10px] text-slate-400 font-bold">مؤسسة الذكاء الاصطناعي للمطاعم</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToDelivery}
            className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-3 py-1.5 rounded-xl transition shadow-md cursor-pointer shrink-0"
          >
            <Truck className="w-3.5 h-3.5 text-orange-500" />
            <span>تطبيق الدليفري 🚚</span>
          </button>
          {currentUser && (
            <button
              onClick={() => signOut(auth)}
              className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition"
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        {!onboardingActive ? (
          /* Feature Landing Grid */
          <div className="max-w-4xl w-full text-center space-y-12">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-orange-50 text-orange-600 border border-orange-200/50 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                مولد التطبيقات والمواقع فوريًا بالذكاء الاصطناعي
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                حوّل منيو مطعمك الورقي إلى <br />
                <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">موقع وبوابة ديليفري تفاعلية</span> بلمح البصر!
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed font-medium">
                ارفع صورة المنيو الخاص بك، وسيقوم الذكاء الاصطناعي بإعداد اللائحة بكتابة أوصاف تسيل اللعاب، ورفع الباركود، وإنشاء رابط مخصص يتيح البيع لزبائنك ديليفري وصالة.
              </p>
            </div>

            {/* Action Card with both Google and email options */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/40 max-w-lg mx-auto overflow-hidden text-right" dir="rtl">
              {/* Premium Splash-Styled Brand Header */}
              <div className="bg-[#fa5a00] p-6 text-center flex flex-col items-center justify-center space-y-3 relative overflow-hidden select-none">
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg shadow-orange-950/20 border-2 border-white/20 animate-bounce duration-3000">
                  <svg className="w-9 h-9 text-[#fa5a00]" viewBox="0 0 128 128" fill="currentColor">
                    <path d="M 28 100 L 58 70" stroke="#fa5a00" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 54 74 C 47 59, 77 33, 97 33 C 107 33, 107 53, 92 68 C 77 83, 61 89, 54 74 Z" />
                    <path d="M 100 100 L 70 70" stroke="#fa5a00" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 33 33 C 43 33, 63 53, 73 73 L 53 73 L 33 53 Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-wide">إسلام فود</h3>
                  <p className="text-[10px] text-orange-100/90 font-medium mt-0.5 font-sans">عالم من المذاق بين يديك</p>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-right text-xs text-slate-600 bg-orange-50/20 p-3.5 rounded-2xl border border-orange-500/10">
                  <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-extrabold">1</span>
                  <span><strong>أسبوع تجريبي مجاني</strong>: استمتع بكافة الميزات الاحترافية فور التسجيل وبدون أي بطاقة دفع لمدة 7 أيام مفعّلة فوراً.</span>
                </div>
                <div className="flex items-start gap-3 text-right text-xs text-slate-600 bg-orange-50/20 p-3.5 rounded-2xl border border-orange-500/10">
                  <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-extrabold">2</span>
                  <span><strong>تخطي قيود المتصفح</strong>: إذا كنت تواجه مشكلة تحميل مع "جوجل بالجيميل"، استخدم تسجيل البريد المباشر بالأسفل للإنشاء والدخول بدقة وسرعة البرق.</span>
                </div>
              </div>

              {/* Auth Selection Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setIsForgotPassword(false); setPasswordResetSent(false); setAuthError(""); }}
                  className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                    !isRegister && !isForgotPassword ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setIsForgotPassword(false); setPasswordResetSent(false); setAuthError(""); }}
                  className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                    isRegister && !isForgotPassword ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  إنشاء حساب جديد
                </button>
              </div>

              {!isRegister && !isForgotPassword && (
                <div className="grid grid-cols-2 p-1 bg-slate-50 border border-slate-200/60 rounded-xl gap-1 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => { setLoginRole("owner"); setAuthError(""); }}
                    className={`py-1.5 text-[10.5px] font-black rounded-lg transition-all ${
                      loginRole === "owner" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    دخول كـ صاحب مطعم 👑
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginRole("call_center"); setAuthError(""); }}
                    className={`py-1.5 text-[10.5px] font-black rounded-lg transition-all ${
                      loginRole === "call_center" ? "bg-orange-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    بوابة الموظفين (الكول سنتر) 🎧
                  </button>
                </div>
              )}

              {/* Interactive Email Auth Form */}
              {isForgotPassword ? (
                <form onSubmit={handlePasswordReset} className="space-y-3 pt-1">
                  {authError && (
                    <div className="bg-red-50 border border-red-200/80 p-3 rounded-xl text-xs font-bold text-red-600 text-right leading-relaxed animate-shake">
                      ⚠️ {authError}
                    </div>
                  )}

                  {passwordResetSent ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs font-bold text-emerald-700 text-right leading-relaxed space-y-3">
                      <p>✨ تم إرسال رابط استعادة كلمة المرور بنجاح!</p>
                      <p className="font-normal text-emerald-600 text-[11px] leading-relaxed">
                        يرجى فحص صندوق الوارد وبريد الرسائل غير المرغوب فيها (Spam) للبريد الإلكتروني: <strong className="underline">{email}</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500 text-right leading-relaxed font-semibold">
                        أدخل بريدك الإلكتروني المسجل وسنقوم بإرسال رابط فوري لإعادة تعيين كلمة مرورك بأمان وسرعة.
                      </p>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500">البريد الإلكتروني</label>
                        <div className="relative">
                          <span className="absolute right-3.5 top-3 text-slate-400">
                            <Mail className="w-4 h-4" />
                          </span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full text-xs font-semibold border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2.5 pr-10 pl-3 bg-slate-50/50 text-right"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setPasswordResetSent(false); setAuthError(""); }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl transition duration-200 cursor-pointer text-xs text-center"
                    >
                      إلغاء والعودة
                    </button>
                    {!passwordResetSent && (
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl transition duration-200 shadow-sm disabled:bg-slate-300 cursor-pointer text-xs text-center"
                      >
                        {loading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                        ) : (
                          "إرسال رابط البدء"
                        )}
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={handleEmailAuth} className="space-y-3 pt-1">
                  {authError === "operation-not-allowed" ? (
                    <div className="bg-orange-50/80 border border-orange-200 p-4 rounded-2xl text-right space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 text-orange-700 font-extrabold text-xs sm:text-sm border-b border-orange-200/40 pb-2">
                        <ShieldAlert className="w-5 h-5 shrink-0 text-orange-600 animate-pulse" />
                        <span>تنبيه هام ومميزات المنظومة 🔐</span>
                      </div>
                      <p className="text-[12px] font-black text-slate-800 leading-relaxed">
                        يرجى التسجيل بالضغط على "الدخول بالبريد الإلكتروني" لتفعيل حسابكم فوراً.
                      </p>
                      <div className="bg-white/95 p-3.5 rounded-xl text-[11px] font-semibold text-slate-600 leading-relaxed space-y-2 border border-slate-100">
                        <p className="font-bold text-orange-600">👑 نظام التحكم الفائق وإدارة المبيعات:</p>
                        <p className="leading-relaxed text-slate-600 font-medium">
                          تتيح المنظومة التحكم الكامل لمالك المؤسسة في إدارة كل مطعم، الدخول المباشر لمتابعة لوحة التحكم، قبول وتحويل الطلبات (الاوردرات)، وضبط الإعدادات الشاملة.
                        </p>
                        <p className="leading-relaxed text-slate-600 font-medium">
                          📞 يمنحك النظام إمكانية التواصل الفوري عبر شات واتساب مدمج يربط بين مالك المؤسسة، ملاك المطاعم، والعملاء لتسهيل تقديم الخدمة وحل أي مشاكل تقنية.
                        </p>
                        <p className="leading-relaxed text-slate-600 font-medium">
                          📈 احصل على رسائل نصائح يومية وتدريب ذكي مخصص ومبسط لزيادة حجم مبيعاتك وأرباح مطعمك باحترافية.
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold leading-relaxed pt-1 flex items-center justify-between border-t border-slate-100">
                        <span>منصة ISLAMFOOD لإدارة المطاعم</span>
                        <button 
                          type="button" 
                          onClick={() => setAuthError("")} 
                          className="bg-slate-200/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-3 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                        >
                          حسناً وفهمت
                        </button>
                      </div>
                    </div>
                  ) : authError && (
                    <div className="bg-red-50 border border-red-200/80 p-3 rounded-xl text-xs font-bold text-red-600 text-right leading-relaxed animate-shake">
                      ⚠️ {authError}
                    </div>
                  )}


                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500">البريد الإلكتروني</label>
                    <div className="relative">
                      <span className="absolute right-3.5 top-3 text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full text-xs font-semibold border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2.5 pr-10 pl-3 bg-slate-50/50 text-right"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-bold text-slate-500">كلمة المرور (6 خانات أو أكثر)</label>
                      {!isRegister && (
                        <button
                          type="button"
                          onClick={() => { setIsForgotPassword(true); setAuthError(""); }}
                          className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                          id="btn-forgot-password"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute right-3.5 top-3 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs font-semibold border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2.5 pr-10 pl-3 bg-slate-50/50 text-right"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl transition duration-200 shadow-sm disabled:bg-slate-300 cursor-pointer"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                        <span>{isRegister ? "تسجيل وإنشاء حساب المطعم" : "دخول مباشر للمطحن الرقمي"}</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {loginRole !== "call_center" && (
                <>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold">أو الدخول باستخدام جوجل</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-50 transition duration-150 cursor-pointer"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span className="text-xs">تسجيل الدخول بالجيميل (Google Account)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-slate-400 text-center">قد يؤدي حظر الكوكيز التابعة لطرف ثالث في المتصفح لتعطل نافذة جوجل المنبثقة للـ iframe، لذلك نوصي بالدخول البريدي المباشر.</p>
                  
                  {/* Delivery App Access Gateway */}
                  <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col items-center justify-center gap-2 text-center">
                    <span className="text-[10px] text-slate-400 font-bold">هل أنت كابتن توصيل (طيار دليفري)؟ 🛵</span>
                    <button
                      type="button"
                      onClick={onNavigateToDelivery}
                      className="inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-600 border border-orange-200/60 hover:bg-orange-100/80 px-4 py-2 rounded-xl transition duration-150 font-black cursor-pointer shadow-xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>افتح تطبيق إسلام فود دليفري 🚚</span>
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        ) : (
          /* Onboarding Form */
          <div className="max-w-xl w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xl shadow-slate-100/50 space-y-6 text-right">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ChefHat className="w-6 h-6 text-orange-500" />
                تحضير حساب مطعمك الرقمي الجديد
              </h2>
              <p className="text-xs text-slate-500 mt-1">يُشرفنا اشتراكك معنا! يرجى إدخال تفاصيل المطعم لإصدار موقعك الفوري تحت رعاية مؤسسة إسلام فود.</p>
            </div>

            {currentUser?.email === "eslamesai12@gmail.com" && (
              <div className="bg-orange-50 border border-orange-200/60 p-4 rounded-2xl text-center space-y-2 mb-2 animate-fade-in">
                <p className="text-xs text-orange-950 font-bold leading-relaxed">
                  مرحباً بك يا أستاذ إسلام! بصفتك مالك مؤسسة إسلام فود، يمكنك تخطي خطوة تفعيل وتحضير متجر جديد والتوجه فوراً لوصاية الإدارة العامة للمنظومة:
                </p>
                <button
                  type="button"
                  onClick={onNavigateToAdmin}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-5 rounded-xl transition shadow-md inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>دخول فوري لبوابة الإدارة العامة لـ إسلام فود 👑</span>
                </button>
              </div>
            )}

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              {/* Business / Enterprise Type */}
              <div className="space-y-1.5 align-right text-right">
                <label className="block text-xs font-bold text-slate-700">نوع النشاط التجاري / المنشأة *</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2.5 px-3 bg-slate-50/50 text-right cursor-pointer"
                >
                  <option value="restaurant">🍔 مطعم / كافيه</option>
                  <option value="supermarket">🛒 سوبر ماركت ومواد غذائية</option>
                  <option value="clothing">👕 ملابس وأزياء</option>
                  <option value="accessories">👜 إكسسوارات وهدايا</option>
                  <option value="other">📦 نشاط تجاري آخر</option>
                </select>
              </div>

              {/* Restaurant Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">اسم المنشأة / التطبيق *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="مثال: مطعم الفيروز للمأكولات الشرقية"
                    className="w-full text-sm border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2 px-3 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Restaurant Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">رقم هاتف المطعم (لاستقبال اتصالات التوصيل) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-slate-400">EG</span>
                  <input
                    type="tel"
                    required
                    value={restaurantPhone}
                    onChange={(e) => setRestaurantPhone(e.target.value)}
                    placeholder="مثال: 01012345678"
                    className="w-full text-sm border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2 px-3 bg-slate-50/50 pl-10"
                  />
                </div>
              </div>

              {/* Restaurant Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">عنوان المطعم بالتفصيل *</label>
                <input
                  type="text"
                  required
                  value={restaurantAddress}
                  onChange={(e) => setRestaurantAddress(e.target.value)}
                  placeholder="مثال: شارع الجلاء، بجوار بنك مصر، طنطا"
                  className="w-full text-sm border border-slate-200 focus:border-orange-500 focus:outline-none rounded-xl py-2 px-3 bg-slate-50/50"
                />
              </div>

              {/* Geographic Coordinates Picker */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="block text-xs font-bold text-slate-700">موقع المطعم الجغرافي (موقع دقيق) *</span>
                  <button
                    type="button"
                    onClick={captureGPSLocation}
                    disabled={gpsLoading}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                  >
                    <Navigation className="w-3 h-3" />
                    {gpsLoading ? "جاري التحديد..." : "التقاط موقعي الحالي GPS"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">هذا الإحداثي حاسم لمطابقة زبائن الصالة ومنع الطلبات من خارج حدود المطعم في المستقبل.</p>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">خط العرض (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={coords.lat}
                      onChange={(e) => setCoords({ ...coords, lat: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs border border-slate-200 focus:outline-none rounded-lg p-1.5 text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">خط الطول (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={coords.lng}
                      onChange={(e) => setCoords({ ...coords, lng: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs border border-slate-200 focus:outline-none rounded-lg p-1.5 text-center font-mono"
                    />
                  </div>
                </div>

                {gpsSuccess && (
                  <div className="text-[10px] mt-2 text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 shrink-0" />
                    تم التقاط إحداثيات موقعك الجغرافي الفعلي بنجاح!
                  </div>
                )}
              </div>

              {/* Header Image File */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">صورة المطعم / الغلاف الرئيسي *</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-50/50 transition relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {imageLoading ? (
                    <span className="text-xs text-slate-400">جاري معالجة الصورة...</span>
                  ) : imageFile ? (
                    <div className="space-y-2">
                      <img
                        src={imageFile}
                        alt="Restaurant Preview"
                        className="h-20 mx-auto rounded-lg object-cover w-32 border"
                      />
                      <span className="text-[10px] text-slate-400 block">تم تحميل الصورة بنجاح (تغيير الصورة)</span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-400 flex flex-col items-center">
                      <Upload className="w-6 h-6 text-slate-300" />
                      <span className="text-xs font-medium">اسحب أو حدد صوره المطعم من ملفات الجهاز</span>
                      <span className="text-[9px]">يدعم JPG, PNG بجودة عالية</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 px-3 py-2 rounded-xl flex items-center gap-2 text-slate-500 border border-slate-100 mt-2">
                <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-[10px] leading-snug">فور التسجيل ستحصل على فترة تجريبية مجانية لمدة <strong>7 أيام</strong>. بعد انتهائها ستتمكن من الترخيص عبر فودافون كاش.</span>
              </div>

              <button
                type="submit"
                disabled={loading || imageLoading}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 transition text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-orange-500/10"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>إصدار موقع وتطبيق المطعم الآن</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Subtle Platform Footer */}
      <footer className="mt-12 mb-6 text-center text-[11px] text-slate-400 space-y-2 border-t border-slate-100 pt-6 max-w-sm mx-auto">
        <p>جميع الحقوق محفوظة © لمنصة <strong className="text-slate-600">ISLAMFOOD</strong> ٢٠٢٦</p>
        <button
          type="button"
          onClick={() => setShowPrivacyPolicy(true)}
          className="text-orange-600 hover:text-orange-700 font-extrabold transition underline cursor-pointer"
        >
          شروط الاستخدام وسياسة الخصوصية ✨
        </button>
      </footer>

      {/* Privacy Policy and Terms and Conditions Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100/85 animate-scale-up flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <h3 className="font-black text-xs">سياسة الخصوصية وشروط الاستخدام لمنصة ISLAMFOOD ✨</h3>
              </div>
              <button
                onClick={() => setShowPrivacyPolicy(false)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-right text-xs leading-relaxed overflow-y-auto text-slate-700">
              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm border-b pb-1">1. تمهيد وتعريف بحقوق الاستخدام</h4>
                <p>
                  منصة <span className="font-extrabold text-orange-600">ISLAMFOOD</span> هي منظومة سحابية متكاملة لربط العملاء بأصحاب المطاعم، إدارة الصالة والمطبخ، وتدريب طواقم ممثلي الكول سنتر بكفاءة عالية.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm border-b pb-1">2. شروط التسجيل واستخدام الخدمة</h4>
                <ul className="list-disc list-inside space-y-1 pr-1">
                  <li>يلتزم أصحاب المطاعم بإدخال بيانات صحيحة ومحدثة تماماً عند التسجيل، بما في ذلك إحداثيات الموقع الجغرافي GPS لضمان دقة توصيل وقبول طلبات النطاق الجغرافي.</li>
                  <li>عند التسجيل الجديد، يمنح النظام فترة تجريبية مجانية مدتها <span className="font-extrabold text-slate-900">7 أيام</span> بكامل الميزات دون رسوم مسبقة.</li>
                  <li>بعد انتهاء الفترة التجريبية، يتوجب شحن رصيد الاشتراك عبر فودافون كاش (كاشير الترخيص) لاستمرار تفعيل موقع العملاء لوضعية الاستقبال النشطة.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm border-b pb-1">3. سياسة حماية وأمن البيانات والخصوصية</h4>
                <ul className="list-disc list-inside space-y-1 pr-1">
                  <li>بيانات مطاعمكم، هويات الموظفين، وأرقام تواصل العملاء مسجلة بأعلى معايير الحماية والتشفير السحابي عبر Firebase Firestore و Authentication.</li>
                  <li>نلتزم التزاماً مطلقاً بعدم بيع، مشاركة، أو كشف قائمة مأكولات أو سجلات أي مطعم مشترك لجهات خارجية.</li>
                  <li>يتحمل صاحب المطعم المسؤولية القانونية الكاملة عن سرية بيانات الدخول الخاصة بحسابه وحساب موظفي الكول سنتر التابعين له.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm border-b pb-1">4. التحكم الشامل وإلغاء التجربة</h4>
                <p>
                  يمنح النظام صاحب المؤسسة أو الإدارة العليا حق الاطلاع وإدارة البيانات، تعديل المنيو والأسعار، والمراقبة الكاملة للاستخدام في أي وقت لضمان سير حركة العمل بسلاسة تامة.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowPrivacyPolicy(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                قرأت الشروط وأوافق عليها 👍
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
