import React, { useState, useEffect } from "react";
import { X, Smartphone, Share, Plus, HelpCircle, ArrowRight } from "lucide-react";

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [appName, setAppName] = useState("إسلام فود");
  const [appIcon, setAppIcon] = useState("");
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Detect iOS
    const checkIOS = () => {
      const uA = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /iPad|iPhone|iPod/.test(uA) && !(window as any).MSStream;
    };
    setIsIOSDevice(checkIOS());

    // Read local cache for branding name/icon
    const cachedName = localStorage.getItem("islamfood_active_customer_app_name");
    const cachedIcon = localStorage.getItem("islamfood_active_customer_app_icon");
    if (cachedName) setAppName(cachedName);
    if (cachedIcon) setAppIcon(cachedIcon);

    const interval = setInterval(() => {
      const currentName = localStorage.getItem("islamfood_active_customer_app_name");
      const currentIcon = localStorage.getItem("islamfood_active_customer_app_icon");
      if (currentName && currentName !== appName) setAppName(currentName);
      if (currentIcon && currentIcon !== appIcon) setAppIcon(currentIcon);
    }, 2500);

    return () => clearInterval(interval);
  }, [appName, appIcon]);

  useEffect(() => {
    // 1. Check if we already have the early-captured prompt from window
    const earlyPrompt = (window as any).deferredInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    // 2. Listen to custom event when prompt becomes available
    const handlePromptAvailable = (e: any) => {
      setDeferredPrompt(e.detail);
    };
    window.addEventListener("pwaPromptAvailable", handlePromptAvailable as EventListener);

    // 3. Hear native event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. Custom window listener for manual trigger (e.g. from a custom button on the page)
    const handleManualShow = () => {
      setShowPrompt(true);
    };
    window.addEventListener("showPwaInstallPrompt", handleManualShow);

    return () => {
      window.removeEventListener("pwaPromptAvailable", handlePromptAvailable as EventListener);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("showPwaInstallPrompt", handleManualShow);
    };
  }, []);

  // Decide if we should show the prompt automatically
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (isStandalone) {
      return; // Already installed, do not show
    }

    const hasDismissed = localStorage.getItem("islamfood_pwa_install_dismissed") === "true";
    if (hasDismissed) {
      return; // User dismissed it, do not show automatically
    }

    // Delay showing the automatic prompt by 3 seconds for better experience
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstallClick = async () => {
    const promptToUse = deferredPrompt || (window as any).deferredInstallPrompt;
    if (promptToUse) {
      try {
        promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
          (window as any).deferredInstallPrompt = null;
          setShowPrompt(false);
          // Save success state to avoid showing again
          localStorage.setItem("islamfood_pwa_install_dismissed", "true");
        }
      } catch (err) {
        console.error("Installation prompt failed:", err);
      }
    } else if (isIOSDevice) {
      // Keep open so they can follow the instructions list, or click understood to dismiss
      setShowPrompt(false);
      localStorage.setItem("islamfood_pwa_install_dismissed", "true");
    } else {
      // Android / Desktop fallback without automatic file downloads:
      alert("لتثبيت التطبيق:\n١. اضغط على نقاط المتصفح الثلاث العليا.\n٢. اختر 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'.");
      setShowPrompt(false);
      localStorage.setItem("islamfood_pwa_install_dismissed", "true");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal so we do not show it automatically again
    localStorage.setItem("islamfood_pwa_install_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      {/* Container simulating the exact gorgeous mockup in the user's image */}
      <div className="bg-white/95 backdrop-blur-md rounded-[32px] p-8 max-w-sm w-full shadow-[0_24px_50px_rgba(0,0,0,0.15)] text-center border border-white/20 relative">
        
        {/* App Icon / Logo inside Circular container exactly like the screenshot */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-700 shadow-md border border-slate-100 overflow-hidden relative">
          {appIcon ? (
            <img src={appIcon} alt={appName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Smartphone className="w-9 h-9 text-slate-600" />
          )}
        </div>

        {/* Modal Title and details */}
        <h3 className="text-lg font-black text-slate-800 leading-snug mb-2">
          تثبيت تطبيق {appName}
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 px-2">
          هل تريد إضافة اختصار تطبيق {appName} إلى الشاشة الرئيسية لجهازك؟ لسرعة تصفح فائقة، وصول فوري بلمسة واحدة، وبدون استهلاك باقة الإنترنت.
        </p>

        {isIOSDevice && (
          <div className="bg-slate-50 p-3.5 rounded-[22px] border border-slate-100 text-right text-[11px] text-slate-600 mb-6 space-y-2 leading-relaxed">
            <p className="font-bold text-slate-800 text-xs text-center border-b border-dashed border-slate-200 pb-1.5 flex items-center justify-center gap-1">
              <span>إرشادات سريعة لهواتف الآيفون 📱🍏</span>
            </p>
            <div className="flex gap-2 items-start">
              <span className="bg-slate-200 text-slate-800 rounded-full w-4 h-4 text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">١</span>
              <p>اضغط على زر المشاركة من شريط سفاري السفلي <span className="font-bold text-slate-800">سفاري (Safari) 📤</span></p>
            </div>
            <div className="flex gap-2 items-start">
              <span className="bg-slate-200 text-slate-800 rounded-full w-4 h-4 text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">٢</span>
              <p>اختر <span className="font-bold text-slate-800">"إضافة للشاشة الرئيسية" (Add to Home Screen) ➕</span> من القائمة.</p>
            </div>
            <div className="flex gap-2 items-start">
              <span className="bg-slate-200 text-slate-800 rounded-full w-4 h-4 text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">٣</span>
              <p>انقر على <span className="font-bold text-slate-800">"إضافة" (Add)</span> بالزاوية العلوية لتثبيت التطبيق فوراً.</p>
            </div>
          </div>
        )}

        {/* Buttons section styled exactly like the screenshot (rounded-2xl block buttons, subtle tones) */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleInstallClick}
            className="w-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold py-3.5 px-4 rounded-[18.5px] transition-all duration-200 text-xs min-h-[44px] cursor-pointer"
          >
            {isIOSDevice ? "حسناً، فهمت الطريقة" : "سماح بالتنزيل والتثبيت"}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-500 font-bold py-3.5 px-4 rounded-[18.5px] border border-slate-100 transition-all duration-200 text-xs min-h-[44px] cursor-pointer"
          >
            عدم السماح / ليس الآن
          </button>
        </div>

      </div>
    </div>
  );
}
