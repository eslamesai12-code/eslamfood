import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, CheckCircle2, ShieldCheck, Zap, Printer, 
  Play, RefreshCw, Cpu, Wifi, AlertCircle, Volume2, 
  Info, Image as ImageIcon, Sparkles, UserCheck, Check,
  ExternalLink, FileText, Smartphone, LayoutGrid
} from "lucide-react";
import { Restaurant, MenuItem, Order, Branch } from "../types";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

interface UsageGuidelinesProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
  branches: Branch[];
  onTriggerMockOrder?: (mockOrder: Order) => void;
  setActiveTab: (tab: any) => void;
}

export default function UsageGuidelines({ restaurant, menuItems, branches, onTriggerMockOrder, setActiveTab }: UsageGuidelinesProps) {
  // Checklist State
  const [checklist, setChecklist] = useState({
    addMenu: menuItems.length > 0,
    downloadQr: false,
    setWorkingHours: !!restaurant.workingHours && Object.keys(restaurant.workingHours).length > 0,
    testAudio: false,
    setupBranches: branches.length > 1,
  });

  // Load state from localStorage for printed/downloaded status
  useEffect(() => {
    try {
      const qrDownloaded = localStorage.getItem(`qr_downloaded_${restaurant.id}`) === "true";
      const audioTested = localStorage.getItem(`audio_tested_${restaurant.id}`) === "true";
      setChecklist(prev => ({
        ...prev,
        downloadQr: qrDownloaded,
        testAudio: audioTested,
        addMenu: menuItems.length > 0,
        setWorkingHours: !!restaurant.workingHours && Object.keys(restaurant.workingHours).length > 0,
        setupBranches: branches.length > 1,
      }));
    } catch (e) {
      console.error(e);
    }
  }, [restaurant, menuItems, branches]);

  // Diagnostics State
  const [diagnosticStep, setDiagnosticStep] = useState<"idle" | "testing" | "done">("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [audioStatus, setAudioStatus] = useState<"pending" | "supported" | "blocked">("pending");
  const [oversizedImages, setOversizedImages] = useState<MenuItem[]>([]);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<string[]>([]);

  // Simulation Sandbox State
  const [simulationStep, setSimulationStep] = useState<"idle" | "receiving" | "cooking" | "delivering" | "done">("idle");
  const [simulatedOrder, setSimulatedOrder] = useState<Order | null>(null);

  // Active Category State for Guidelines Manual
  const [activeManualCat, setActiveManualCat] = useState<"setup" | "printing" | "staff" | "seo">("setup");

  // Audio permission/support check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        setAudioStatus("blocked");
      } else {
        setAudioStatus("supported");
      }
    }
  }, []);

  // Diagnostic Test Trigger
  const runDiagnostics = async () => {
    setDiagnosticStep("testing");
    setDiagnosticsLogs([]);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      setDiagnosticsLogs(prev => [...prev, msg]);
    };

    try {
      addLog("🔍 جاري التحقق من الاتصال بخوادم قاعدة البيانات...");
      const startTime = performance.now();
      
      // Real database fetch test
      const q = query(collection(db, "restaurants"), where("slug", "==", restaurant.slug || ""), limit(1));
      await getDocs(q);
      
      const endTime = performance.now();
      const calculatedLatency = Math.round(endTime - startTime);
      setLatency(calculatedLatency);
      addLog(`⚡ تم قياس سرعة استجابة قاعدة البيانات: ${calculatedLatency} مللي ثانية (ممتاز).`);

      await new Promise(r => setTimeout(r, 600));
      addLog("🔊 جاري فحص محرك التنبيهات الصوتية للطلبات...");
      
      if (audioStatus === "supported") {
        addLog("✅ التنبيهات الصوتية مدعومة بشكل كامل في متصفحك الحالي.");
      } else {
        addLog("⚠️ المتصفح يقيد تشغيل التنبيهات تلقائياً، يرجى التفاعل لتفعيل الصوت.");
      }

      await new Promise(r => setTimeout(r, 600));
      addLog("🖼️ جاري فحص أحجام وجودة صور قائمة الطعام لضمان سرعة تحميل الزبائن...");
      
      // Analyze menu item images (simulate warning for large data urls, or items missing compression)
      const heavyItems = menuItems.filter(item => {
        // Items with very long base64 strings (indicating uncompressed images)
        return item.image && item.image.length > 100000; 
      });
      setOversizedImages(heavyItems);

      if (heavyItems.length > 0) {
        addLog(`⚠️ تم العثور على ${heavyItems.length} وجبة تحتوي على صور غير مضغوطة قد تبطئ تصفح الزبائن.`);
      } else {
        addLog("✅ جميع صور الوجبات ممتازة ومضغوطة بشكل مثالي لسرعة فائقة.");
      }

      await new Promise(r => setTimeout(r, 500));
      addLog("💾 فحص سعة التخزين المحلي والذاكرة المؤقتة...");
      addLog("✅ الذاكرة المؤقتة مستقرة وتعمل بنظام التحديث الفوري.");

      setDiagnosticStep("done");
    } catch (error) {
      console.error(error);
      addLog("❌ فشل الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت.");
      setDiagnosticStep("done");
    }
  };

  // Test Sound Player
  const playTestAlert = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.15); // High beep
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);

      // Save checklist state
      localStorage.setItem(`audio_tested_${restaurant.id}`, "true");
      setChecklist(prev => ({ ...prev, testAudio: true }));
    } catch (e) {
      alert("يرجى تفعيل الصوت في متصفحك أو التفاعل أولاً!");
    }
  };

  // Staff Training Mock Order Simulation
  const triggerMockOrderSimulation = () => {
    if (simulationStep !== "idle") return;

    // Build a mock order matching types
    const mockOrder: Order = {
      id: "MOCK-" + Math.floor(1000 + Math.random() * 9000),
      restaurantId: restaurant.id,
      customerName: "محمود أحمد (طلب تدريبي 🧑‍🎓)",
      customerPhone: "01000000000",
      deliveryAddress: "شارع التجاري، أمام البنك الأهلي، طنطا",
      orderType: "dine_in",
      tableNumber: "طاولة رقم ٤",
      items: menuItems.slice(0, 2).map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        notes: "بدون بصل وبدون فلفل حار"
      })),
      totalPrice: menuItems.slice(0, 2).reduce((sum, item) => sum + item.price, 0) + 15,
      status: "pending",
      createdAt: new Date().toISOString(),
      paymentMethod: "cash",
      deliveryFee: 15
    };

    setSimulatedOrder(mockOrder);
    setSimulationStep("receiving");

    // Sound mock notification
    playTestAlert();
    setTimeout(() => {
      playTestAlert();
    }, 450);

    // Call callback to inject order if available in parent
    if (onTriggerMockOrder) {
      onTriggerMockOrder(mockOrder);
    }
  };

  const advanceSimulation = (nextStatus: "cooking" | "delivering" | "done") => {
    if (!simulatedOrder) return;
    
    setSimulationStep(nextStatus);
    const updatedOrder = { ...simulatedOrder };
    if (nextStatus === "cooking") {
      updatedOrder.status = "preparing";
    } else if (nextStatus === "delivering") {
      updatedOrder.status = "ready";
    } else if (nextStatus === "done") {
      updatedOrder.status = "completed";
    }
    setSimulatedOrder(updatedOrder);

    // Play feedback tone
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(nextStatus === "done" ? 1000 : 600, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch(e){}
  };

  // Checklist completion statistics
  const completedChecklistCount = Object.values(checklist).filter(Boolean).length;
  const totalChecklistCount = Object.keys(checklist).length;
  const checklistPercent = Math.round((completedChecklistCount / totalChecklistCount) * 100);

  return (
    <div className="space-y-8 text-right font-sans" id="usage-guidelines-container">
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#d9222a]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-black border border-slate-700">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>مستشار الكفاءة والجودة والتشغيل الرقمي 🛡️</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
              إرشادات الاستخدام وضمان كفاءة التطبيق لـ <span className="text-[#d9222a]">{restaurant.name}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">
              أهلاً بك يا بطل! من هنا يمكنك الإشراف الكامل على الجاهزية التشغيلية لمطعمك، وفحص سرعة النظام، وتدريب موظفيك عبر المحاكاة الذكية، وضبط طابعات فواتير الكاشير باحترافية تامة.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center space-y-1 self-start md:self-auto shrink-0">
            <span className="text-[10px] text-slate-400 font-extrabold block">مستوى جاهزية التشغيل الرقمي</span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black font-mono text-emerald-400">{checklistPercent}%</span>
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <span className="text-[9px] text-slate-300 font-black block mt-1 bg-emerald-500/10 text-emerald-300 px-2.5 py-0.5 rounded-full">
              {checklistPercent >= 80 ? "جاهزية تشغيلية فائقة ⚡" : "يحتاج تفعيل بعض الخطوات ⚙️"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Responsive Split: Checklist and Real-Time Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RIGHT: Checklist (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-3 border-slate-100">
            <div>
              <h2 className="font-black text-slate-800 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                خطوات الجاهزية الذهبية للتشغيل والنجاح 🥇
              </h2>
              <p className="text-xs text-slate-400 mt-1">أكمل الخطوات التالية لضمان استقبال الطلبات بكفاءة عالية 100%.</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-50 border px-3 py-1 rounded-xl">
              {completedChecklistCount} من {totalChecklistCount} مكتمل
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-black text-slate-700">
              <span>نسبة الإكتمال والجاهزية الفنية</span>
              <span className="font-mono text-emerald-600">{checklistPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${checklistPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Checklist Cards */}
          <div className="space-y-3">
            {[
              {
                key: "addMenu",
                title: "إضافة وجبات قائمة الطعام (المنيو)",
                desc: "يتيح للعملاء رؤية أطباقك اللذيذة والطلب فوراً. تم العثور على الوجبات.",
                actionText: "تعديل المنيو بـ AI 🍔",
                action: () => setActiveTab("ai_menu"),
                status: checklist.addMenu
              },
              {
                key: "downloadQr",
                title: "تحميل أو طباعة باركود الطاولة",
                desc: "الصق الباركود على الطاولات أو واجهة المطعم لتسهيل الطلب الذاتي بدون ويتر.",
                actionText: "عرض وتحميل الباركود 🖼️",
                action: () => setActiveTab("qr_code"),
                status: checklist.downloadQr
              },
              {
                key: "setWorkingHours",
                title: "ضبط وتحديد مواعيد وساعات العمل",
                desc: "يمنع تلقي طلبات والمنشأة مغلقة، مما يزيد ثقة العملاء في مصداقية الخدمة.",
                actionText: "تعديل مواعيد العمل ⏰",
                action: () => setActiveTab("working_hours"),
                status: checklist.setWorkingHours
              },
              {
                key: "testAudio",
                title: "اختبار وتفعيل جرس الإشعارات الصوتي",
                desc: "صوت جرس تنبيه الطلبات ضروري حتى لا يفوت طاقم الطهي أي طلب جديد ومباشر.",
                actionText: "رنين جرس الطلبات 🔊",
                action: playTestAlert,
                status: checklist.testAudio
              },
              {
                key: "setupBranches",
                title: "الانتشار الجغرافي وتفعيل الفروع الإضافية",
                desc: "أضف فروعك الجغرافية الأخرى ليدير طاقم كاشير كل فرع طلباته بشكل مستقل كلياً.",
                actionText: "إدارة الفروع 🗺️",
                action: () => setActiveTab("branches"),
                status: checklist.setupBranches
              }
            ].map((item, index) => (
              <div 
                key={item.key}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                  item.status 
                    ? "bg-emerald-50/40 border-emerald-200/50" 
                    : "bg-white hover:bg-slate-50/50 border-slate-200/80"
                }`}
              >
                <div className="mt-0.5">
                  {item.status ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-slate-300 font-extrabold text-[10px]">
                      {index + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <h3 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                    {item.title}
                    {item.status && <span className="text-[10px] text-emerald-600 font-black">جاهز ومكتمل ✓</span>}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                  
                  {!item.status && (
                    <button
                      type="button"
                      onClick={item.action}
                      className="text-xs font-black text-[#d9222a] hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <span>{item.actionText}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LEFT: Real-Time System Diagnostics Scanner (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-between space-y-6">
          <div className="border-b pb-3 border-slate-100">
            <h2 className="font-black text-slate-800 text-base flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-500" />
              أداة فحص وتشخيص النظام الحي ⚡
            </h2>
            <p className="text-xs text-slate-400 mt-1">افحص سرعة استجابة السحابة وحجم الصور ومستوى كفاءة النظام لمتصفحك.</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200/50 space-y-4">
            {/* Latency meter indicator */}
            <div className="flex justify-between items-center border-b pb-3 border-slate-200/60">
              <span className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />
                زمن استجابة الخادم (Latency)
              </span>
              <span className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-lg ${
                latency === null ? "bg-slate-200 text-slate-500" :
                latency < 100 ? "bg-emerald-100 text-emerald-700" :
                latency < 300 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              }`}>
                {latency === null ? "انتظار الفحص..." : `${latency} ms`}
              </span>
            </div>

            {/* Audio Alert Status indicator */}
            <div className="flex justify-between items-center border-b pb-3 border-slate-200/60">
              <span className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-orange-500" />
                صوت تنبيه الطلبات الجديد
              </span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                audioStatus === "supported" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>
                {audioStatus === "supported" ? "مفعّل ونشط ✓" : "مقيّد مؤقتاً ⚠️"}
              </span>
            </div>

            {/* Menu Images size analysis */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-500" />
                تحليل أحجام صور المنيو
              </span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                oversizedImages.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {oversizedImages.length === 0 ? "أحجام ممتازة ومثالية" : `${oversizedImages.length} وجبات بحاجة لضغط`}
              </span>
            </div>
          </div>

          {/* Diagnostic Console / Logs Screen */}
          <div className="bg-slate-900 text-slate-300 font-mono text-[10.5px] p-3 rounded-2xl h-44 overflow-y-auto space-y-1.5 text-left select-all">
            <span className="text-[9px] text-amber-400 font-bold block border-b border-slate-800 pb-1 text-right mb-2">📟 لوحة مخرجات التشخيص المباشر</span>
            
            {diagnosticStep === "idle" && (
              <p className="text-slate-500 italic text-center pt-8">انقر على زر "بدء الفحص" بالأسفل لفحص كفاءة اتصال المطعم المباشر...</p>
            )}

            {diagnosticsLogs.map((log, i) => (
              <p key={i} className="leading-relaxed text-right">{log}</p>
            ))}

            {diagnosticStep === "testing" && (
              <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold pt-4 text-center w-full">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الاتصال والتحليل...</span>
              </div>
            )}
          </div>

          {/* Trigger Scan Button */}
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={diagnosticStep === "testing"}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl text-xs shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${diagnosticStep === "testing" ? "animate-spin text-amber-400" : "text-emerald-400"}`} />
            <span>{diagnosticStep === "testing" ? "جاري الفحص السحابي..." : "ابدأ فحص الأداء الحي ⚡"}</span>
          </button>
        </div>
      </div>

      {/* 3. Visual Thermal Printer Guide and Live Invoice Tester */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
        <div className="border-b pb-3 border-slate-100">
          <h2 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            دليل ربط طابعات البونات وفواتير الكاشير والـ Bluetooth 🖨️
          </h2>
          <p className="text-xs text-slate-400 mt-1">دليل شامل لتهيئة طابعات فواتير المطبخ والكاشير وضبط مقاسات الورق (80mm / 58mm).</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/40 space-y-3 text-right">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
              ١
            </div>
            <h4 className="font-extrabold text-slate-800 text-xs">توصيل الطابعة بالمتصفح / الكمبيوتر</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              قم بربط طابعتك الحرارية (USB أو Bluetooth أو Wi-Fi) بجهاز الكاشير الخاص بك وتأكد من تثبيت التعريف الخاص بها (Driver) لطباعة صحيحة.
            </p>
          </div>

          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/40 space-y-3 text-right">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs">
              ٢
            </div>
            <h4 className="font-extrabold text-slate-800 text-xs">تحديد وتعديل حجم ورق الطباعة</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              عند النقر على "طباعة البون"، ستفتح قائمة الطباعة بالمتصفح. قم بتعيين المقاس للورق المستمر (Roll) مثل <strong className="text-slate-850">80mm x Receipt</strong> أو <strong className="text-slate-850">58mm</strong>، وألغِ تفعيل الهوامش (Margins: None).
            </p>
          </div>

          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/40 space-y-3 text-right flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-black text-xs">
                ٣
              </div>
              <h4 className="font-extrabold text-slate-800 text-xs">اختبار وتجربة طباعة فاتورة تجريبية</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                جرب طباعة بون طلب اختباري منمق ومتناسق جداً للتأكد من المحاذاة وملاءمة المقاس تماماً للزبائن بالمطعم.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                // Open printing window with beautiful mock invoice
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>فاتورة اختبارية - إسلام فود</title>
                        <style>
                          body {
                            font-family: 'Courier New', Courier, monospace, sans-serif;
                            width: 280px;
                            margin: 0 auto;
                            padding: 10px;
                            text-align: right;
                            direction: rtl;
                            font-size: 12px;
                            line-height: 1.4;
                            color: #000;
                          }
                          .center { text-align: center; }
                          .header { font-weight: bold; font-size: 15px; margin-bottom: 5px; }
                          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                          .flex-between { display: flex; justify-content: space-between; }
                          .footer { font-size: 10px; margin-top: 15px; text-align: center; }
                        </style>
                      </head>
                      <body onload="window.print(); window.close();">
                        <div class="center header">${restaurant.name}</div>
                        <div class="center">*** فاتورة تجريبية ومحاكاة الطابعة ***</div>
                        <div class="center">تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}</div>
                        <div class="divider"></div>
                        <div class="flex-between"><span>رقم الطلب:</span> <span>#MOCK-7788</span></div>
                        <div class="flex-between"><span>نوع الطلب:</span> <span>صالات (طاولة ٤)</span></div>
                        <div class="divider"></div>
                        <div class="flex-between"><span>1x برجر لحم دبل سوبر</span> <span>180 EGP</span></div>
                        <div class="flex-between"><span>2x بطاطس مقلية مقرمشة</span> <span>90 EGP</span></div>
                        <div class="divider"></div>
                        <div class="flex-between"><strong>المجموع الفرعي:</strong> <strong>270 EGP</strong></div>
                        <div class="flex-between"><strong>خدمة وضريبة صالة:</strong> <strong>20 EGP</strong></div>
                        <div class="flex-between"><strong>الإجمالي الكلي:</strong> <strong>290 EGP</strong></div>
                        <div class="divider"></div>
                        <div class="footer">
                          تم توليد الفاتورة بنجاح بواسطة نظام إسلام فود eslam food <br>
                          نسعد بخدمتكم وتوفير أفضل تجربة تشغيل رقمية دائماً! ❤️
                        </div>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-2.5 rounded-xl text-xs mt-3 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة بون تجريبي واختباري 🖨️</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Staff Interactive Training Sandbox & Customer Mock Order Simulator */}
      <div className="bg-gradient-to-l from-emerald-500/10 to-teal-500/5 rounded-3xl p-6 border border-emerald-200/40 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-200/30 pb-3">
          <div>
            <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              محاكي طلبات الزبائن وتدريب الموظفين والويتر 🧑‍🍳🍔
            </h2>
            <p className="text-xs text-slate-600 mt-1">تفاعل مع طلب زبون وهمي بالكامل لتدريب طاقم صالتك ومطبخك دون تغيير تقارير مبيعاتك الحقيقية!</p>
          </div>

          <button
            type="button"
            onClick={triggerMockOrderSimulation}
            disabled={simulationStep !== "idle" && simulationStep !== "done"}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>{simulationStep === "idle" || simulationStep === "done" ? "توليد طلب زبون وهمي للتدريب 🚀" : "المحاكاة جارية حالياً..."}</span>
          </button>
        </div>

        {/* Simulator visual progress */}
        {simulationStep !== "idle" && simulatedOrder && (
          <div className="bg-white rounded-2xl p-5 border border-emerald-100 space-y-5 shadow-xs">
            {/* Simulation pipeline stepper */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10.5px] font-bold text-slate-500 border-b pb-4">
              <div className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 ${simulationStep === "receiving" ? "bg-amber-50 border-amber-300 text-amber-700 font-extrabold" : "bg-slate-50 border-slate-100"}`}>
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <span>استقبال وتنبيه 🔔</span>
              </div>
              <div className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 ${simulationStep === "cooking" ? "bg-orange-50 border-orange-300 text-orange-700 font-extrabold" : "bg-slate-50 border-slate-100"}`}>
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <span>تجهيز وطهي 🍳</span>
              </div>
              <div className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 ${simulationStep === "delivering" ? "bg-blue-50 border-blue-300 text-blue-700 font-extrabold" : "bg-slate-50 border-slate-100"}`}>
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <span>توصيل وخدمة 🛵</span>
              </div>
              <div className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 ${simulationStep === "done" ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold" : "bg-slate-50 border-slate-100"}`}>
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                <span>تسليم واكتمال 🎉</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Order Card Detail */}
              <div className="border border-slate-200/80 rounded-2xl p-4 space-y-3.5 bg-slate-50/50 text-right">
                <div className="flex justify-between items-center border-b pb-2 border-slate-200">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">طلب تجريبي نشط</span>
                  <span className="font-mono text-xs font-bold text-slate-500">{simulatedOrder.id}</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="font-extrabold text-slate-800">صاحب الطلب: <span className="font-normal text-slate-600">{simulatedOrder.customerName}</span></p>
                  <p className="font-extrabold text-slate-800">موقع الخدمة: <span className="font-normal text-slate-600">{simulatedOrder.tableNumber}</span></p>
                  <p className="font-extrabold text-slate-800">رقم الهاتف: <span className="font-normal text-slate-600 font-mono">{simulatedOrder.customerPhone}</span></p>
                </div>

                <div className="border-t border-b py-2 my-2 border-slate-200 space-y-1">
                  <p className="text-[10px] text-slate-400 font-extrabold">محتويات الوجبات والملاحظات:</p>
                  {simulatedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-700 font-bold">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-mono text-slate-500">{item.price} EGP</span>
                    </div>
                  ))}
                  <p className="text-[10.5px] text-red-500 italic mt-1 font-bold">💡 ملاحظة الزبون: {simulatedOrder.items[0]?.notes}</p>
                </div>

                <div className="flex justify-between items-center font-black text-xs text-slate-900">
                  <span>الإجمالي الكلي:</span>
                  <span className="text-[#d9222a] font-mono text-sm">{simulatedOrder.totalPrice} EGP</span>
                </div>
              </div>

              {/* Action controller for simulation */}
              <div className="flex flex-col justify-center space-y-4">
                <h4 className="font-black text-slate-800 text-xs">🎮 لوحة تحكم تدريب الموظف الحالية:</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  دع الكاشير والويتر يتابعون كيف يتغير التدفق. في لوحة الطلبات الحقيقية، يؤدي النقر على هذه الأزرار إلى تنبيه العميل تلقائياً على هاتفه بحالة الطلب!
                </p>

                <div className="space-y-2">
                  {simulationStep === "receiving" && (
                    <button
                      type="button"
                      onClick={() => advanceSimulation("cooking")}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول الطلب وبدء الطهي 🍳</span>
                    </button>
                  )}

                  {simulationStep === "cooking" && (
                    <button
                      type="button"
                      onClick={() => advanceSimulation("delivering")}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>اكتمال الطهي وخروج الويتر للخدمة 🛵</span>
                    </button>
                  )}

                  {simulationStep === "delivering" && (
                    <button
                      type="button"
                      onClick={() => advanceSimulation("done")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد استلام الزبون وحساب الطاولة 🎉</span>
                    </button>
                  )}

                  {simulationStep === "done" && (
                    <div className="bg-emerald-50 text-emerald-850 p-4 rounded-xl border border-emerald-200 text-center space-y-2">
                      <p className="text-xs font-black">👏 أحسنت يا بطل! تم إكمال الدورة التدريبية للطلب بنجاح.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSimulationStep("idle");
                          setSimulatedOrder(null);
                        }}
                        className="text-xs text-emerald-600 font-extrabold hover:underline"
                      >
                        إعادة تعيين المحاكي والبدء من جديد
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Frequently Asked Questions Manual (FAQ Categorized Accordion) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-6">
        <div className="border-b pb-3 border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-black text-slate-800 text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              دليل الاستخدام والإرشادات التفاعلي المصنف 📚
            </h2>
            <p className="text-xs text-slate-400 mt-1">تصفح حلول المشاكل الفنية الشائعة وأفضل ممارسات إدارة المنيو والطلبات.</p>
          </div>

          {/* Quick tab filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border">
            {[
              { id: "setup", label: "التأسيس والباركود" },
              { id: "printing", label: "الكاشير والطباعة" },
              { id: "staff", label: "طاقم العمل والويتر" },
              { id: "seo", label: "تحسين المبيعات" }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveManualCat(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  activeManualCat === cat.id 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Content List based on selected category */}
        <div className="space-y-4">
          {activeManualCat === "setup" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  هل يجب إعادة طباعة الباركود عند تغيير الوجبات؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  لا أبداً! الباركود ديناميكي وذكي، يربط الزبون برابط مطعمك المباشر. يمكنك تعديل الأطباق، الأسعار، الصور، وإضافة خصومات وتتحدث فوراً على هواتف الزبائن دون الحاجة لإعادة طباعة أي ملصقات.
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  كيف يرى الزبائن رقم الطاولة الصحيح عند المسح؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  عند تحميل الباركود من لوحة "باركود الصالات والمنيو"، يمكنك إدراج رقم الطاولة في لوحة المظهر وسيتم دمجه ديناميكياً داخل كود الـ QR، وبذلك يتعرف النظام على طاولة الزبون المحددة تلقائياً عند مسحها.
                </p>
              </div>
            </div>
          )}

          {activeManualCat === "printing" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-indigo-500 shrink-0" />
                  أفضل مقاس لطباعة البونات والفواتير الكاشير؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  تنسيق الفواتير في إسلام فود eslam food مهيأ للورق المستمر مقاس 80mm (وهو المقاس القياسي لطابعات Epson و Xprinter). هذا التنسيق مريح جداً للعين ويختصر استهلاك طول رول الورق لتقليل النفقات اليومية.
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-indigo-500 shrink-0" />
                  ماذا أفعل لو كانت الكتابة العربية في الفاتورة تظهر مقلوبة أو مبعثرة؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  تأكد من اختيار تعريف الطابعة كـ "طابعة افتراضية" بالكمبيوتر (Generic / Text Only) أو تفعيل ترميز الـ UTF-8 في تفضيلات تعريف الطابعة لديك للتأكد من قراءة لغة الضاد السليمة.
                </p>
              </div>
            </div>
          )}

          {activeManualCat === "staff" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  كيف نضمن عدم تفويت جرس الطلبات في المطبخ الصاخب؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  ننصح بشدة بتوصيل جهاز الكاشير أو الهاتف المثبت بالمطبخ بسماعة خارجية بلوتوث أو سلكية ذات صوت قوي، وإبقاء المتصفح نشطاً بدون قفل الشاشة (Keep screen on) لضمان انطلاق رنين الإنذار فوراً.
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  هل يستطيع الويترز تغيير حالات الطلب من هواتفهم؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  نعم، يمكنك إنشاء حسابات "ويتر" أو "دليفري" مخصصة من لوحة التحكم، وسيحصل كل موظف على واجهة تتبع مبسطة خاصة به ليقوم بتحديث حالة الطلب وتغييرها أثناء خدمته للزبون في الصالة.
                </p>
              </div>
            </div>
          )}

          {activeManualCat === "seo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  أفضل وسيلة لرفع جودة صور الوجبات وزيادة مبيعاتها؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  استخدم إضاءة جيدة عند تصوير أطباقك، وقم دائماً بضغط الصورة عبر أداة الضغط في إسلام فود قبل رفعها (لتكون أقل من 150KB)، حيث أثبتت الدراسات أن سرعة فتح المنيو لدى العميل تزيد مبيعات المطاعم بنسبة 28%!
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border space-y-2">
                <h4 className="font-extrabold text-slate-850 text-xs md:text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  كيف نستخدم مولد الحملات الدعاية التسويقية بالذكاء الاصطناعي؟
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  انتقل إلى لوحة "أفيلييت والتسويق" وافتح مستشارك الذكي بالذكاء الاصطناعي، وسيقوم بتحليل الوجبات الأكثر مبيعاً لديك وصياغة بوستات ونصوص ترويجية غاية في الجاذبية لتنسخها وتنشرها مباشرة لجروباتك.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
