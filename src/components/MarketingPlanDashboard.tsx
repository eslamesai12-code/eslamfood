import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot 
} from "firebase/firestore";
import { 
  Target, TrendingUp, Plus, Trash2, Megaphone, Calendar, DollarSign, Users, 
  Award, Sparkles, Share2, FileText, Check, Printer, Bot, Volume2, Percent, 
  Tag, Lightbulb, BookOpen, ChevronRight, AlertCircle, ShoppingBag, Send, X, Edit3, Clipboard
} from "lucide-react";
import { Restaurant } from "../types";
import MarketingAgentsTab from "./MarketingAgentsTab";

interface MarketingPlanDashboardProps {
  restaurants: Restaurant[];
  selectedRestaurantId: string;
  setSelectedRestaurantId: (id: string) => void;
}

interface Campaign {
  id?: string;
  name: string;
  channel: string;
  targetAudience: "all" | "owners" | "customers";
  startDate: string;
  endDate: string;
  budget: number;
  objective: string;
  content: string;
  status: "active" | "scheduled" | "completed";
  estimatedReach: number;
  estimatedConversions: number;
  createdAt: string;
}

interface PromoCode {
  id?: string;
  code: string;
  discountPercentage: number;
  maxUses: number;
  currentUses: number;
  expiryDate: string;
  status: "active" | "expired";
}

export default function MarketingPlanDashboard({ 
  restaurants, 
  selectedRestaurantId, 
  setSelectedRestaurantId 
}: MarketingPlanDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "campaigns" | "promos" | "vault" | "agents">("dashboard");
  
  // Database states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingPromos, setLoadingPromos] = useState(true);

  // New Campaign Form
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [campName, setCampName] = useState("");
  const [campChannel, setCampChannel] = useState("فيسبوك وانستغرام الممولة 🟦");
  const [campAudience, setCampAudience] = useState<"all" | "owners" | "customers">("all");
  const [campStart, setCampStart] = useState(new Date().toISOString().split('T')[0]);
  const [campEnd, setCampEnd] = useState(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [campBudget, setCampBudget] = useState(1500);
  const [campObjective, setCampObjective] = useState("زيادة عدد الزيارات والطلبات المباشرة");
  const [campContent, setCampContent] = useState("");

  // New Promo Form
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(15);
  const [promoMaxUses, setPromoMaxUses] = useState(100);
  const [promoExpiry, setPromoExpiry] = useState(new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);

  // Copywriting/AI assistant State
  const [aiSelectedTemplate, setAiSelectedTemplate] = useState("customers_weekend");
  const [aiCustomizedText, setAiCustomizedText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Egypt Marketing Channels
  const marketingChannels = [
    { id: "facebook", name: "إعلانات فيسبوك وانستغرام الممولة 🟦", costPerMil: 35, avgCtr: 0.04, desc: "الوصول المباشر للعملاء الجغرافيين بالمناطق المحيطة بالمطاعم." },
    { id: "whatsapp", name: "بث واتساب المباشر والأتمتة 🟢", costPerMil: 5, avgCtr: 0.18, desc: "إرسال نصائح ترويجية وكوبونات مخصصة للعملاء والملاك مباشرة." },
    { id: "tiktok", name: "صناع المحتوى وتيك توك ريلز 🎬", costPerMil: 45, avgCtr: 0.03, desc: "استهداف الشباب وتصوير كواليس تحضير الوجبات بشكل مبهر بصرياً." },
    { id: "offline", name: "ملصقات وباركود QR وبنرات جغرافية 🗺️", costPerMil: 15, avgCtr: 0.12, desc: "الترويج الأرضي وتوزيع كروت الخصم عند تسليم الطلبات الخارجية." },
    { id: "sms", name: "رسائل الجوال القصيرة المستهدفة 📱", costPerMil: 20, avgCtr: 0.08, desc: "إشعارات سريعة للعملاء بعروض نهاية الأسبوع ووجبات اليوم المميزة." },
  ];

  // Load Campaigns & Promo codes from Firestore in real-time
  useEffect(() => {
    setLoadingCampaigns(true);
    const unsub = onSnapshot(collection(db, "marketing_campaigns"), (snap) => {
      const list: Campaign[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Campaign);
      });
      // Sort by creation date
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(list);
      setLoadingCampaigns(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "marketing_campaigns");
      setLoadingCampaigns(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoadingPromos(true);
    const unsub = onSnapshot(collection(db, "marketing_promo_codes"), (snap) => {
      const list: PromoCode[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PromoCode);
      });
      setPromos(list);
      setLoadingPromos(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "marketing_promo_codes");
      setLoadingPromos(false);
    });
    return () => unsub();
  }, []);

  // Pre-seed default campaigns if list is empty, just for nice presentation
  const handleSeedDefaultCampaigns = async () => {
    if (campaigns.length > 0) return;
    try {
      const defaults: Campaign[] = [
        {
          name: "حملة إطلاق منيو الصيف وعروض التوصيل المجاني 🍔",
          channel: "إعلانات فيسبوك وانستغرام الممولة 🟦",
          targetAudience: "customers",
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
          budget: 2500,
          objective: "زيادة الزوار اليوميين للطلب المباشر في المحافظات الكبرى",
          content: "الصيف محتاج أكلة تفتح النفس وجو رايق! 🥤 اطلب دلوقتي وجبتك المفضلة من أقرب فرع ليك بخصم 15% وتوصيل مجاني تماماً طوال الأسبوع. اضغط على الرابط واكتشف المنيو الجديد فوراً!",
          status: "active",
          estimatedReach: 45000,
          estimatedConversions: 1850,
          createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
        },
        {
          name: "حملة استقطاب ملاك مطاعم جدد (انضم لإسلام فود) 👑",
          channel: "بث واتساب المباشر والأتمتة 🟢",
          targetAudience: "owners",
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          budget: 1200,
          objective: "زيادة المشتركين الجدد في المنصة وتحقيق الأهداف الجغرافية",
          content: "بتدفع عمولة 30% لتطبيقات التوصيل ومبيعاتك بتقل؟ 📉 امتلك منيو إلكتروني ذكي بالكامل باسم مطعمك، واستقبل طلباتك على الواتساب وبدون أي عمولات إضافية! سجل واشترك فوراً مع تجربة مجانية 14 يوم.",
          status: "scheduled",
          estimatedReach: 15000,
          estimatedConversions: 450,
          createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        }
      ];

      for (const camp of defaults) {
        await addDoc(collection(db, "marketing_campaigns"), camp);
      }
      
      // Also seed promo codes
      const defaultPromos: PromoCode[] = [
        { code: "ISLAM15", discountPercentage: 15, maxUses: 200, currentUses: 45, expiryDate: "2026-12-31", status: "active" },
        { code: "OWNERVIP", discountPercentage: 25, maxUses: 50, currentUses: 12, expiryDate: "2026-09-30", status: "active" },
        { code: "FREEPASS", discountPercentage: 100, maxUses: 10, currentUses: 3, expiryDate: "2026-08-15", status: "active" }
      ];

      for (const pr of defaultPromos) {
        await addDoc(collection(db, "marketing_promo_codes"), pr);
      }

      alert("🎉 تم تهيئة وزراعة خطة التسويق والحملات الافتراضية بنجاح في قاعدة البيانات!");
    } catch (err) {
      alert("فشل تهيئة البيانات الافتراضية.");
    }
  };

  // Handle Save Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim() || !campContent.trim()) {
      alert("الرجاء إدخال اسم الحملة ومحتوى النص الترويجي.");
      return;
    }

    // Estimate parameters based on budget and selected channel
    const selectedChan = marketingChannels.find(c => c.name === campChannel) || marketingChannels[0];
    const estimatedReach = Math.round((campBudget / selectedChan.costPerMil) * 10000);
    const estimatedConversions = Math.round(estimatedReach * selectedChan.avgCtr);

    try {
      const newCamp: Campaign = {
        name: campName,
        channel: campChannel,
        targetAudience: campAudience,
        startDate: campStart,
        endDate: campEnd,
        budget: Number(campBudget),
        objective: campObjective,
        content: campContent,
        status: "active",
        estimatedReach,
        estimatedConversions,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "marketing_campaigns"), newCamp);
      
      // Dispatch alert custom notification
      const customEvent = new CustomEvent("islamfood_new_tip_alert", { 
        detail: `🚀 أطلق مسؤولو الإدارة حملة تسويقية جديدة: "${campName}" بميزانية قدرها ${campBudget} ج.م لاستهداف عملاء وملاك المنصة!` 
      });
      window.dispatchEvent(customEvent);

      setShowAddCampaignModal(false);
      setCampName("");
      setCampContent("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "marketing_campaigns");
    }
  };

  // Handle Save Promo Code
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim() || Number(promoDiscount) <= 0) {
      alert("الرجاء إدخال كود كوبون صالح ونسبة الخصم.");
      return;
    }

    try {
      const newPromo: PromoCode = {
        code: promoCode.toUpperCase().replace(/\s+/g, ""),
        discountPercentage: Number(promoDiscount),
        maxUses: Number(promoMaxUses),
        currentUses: 0,
        expiryDate: promoExpiry,
        status: "active"
      };

      await addDoc(collection(db, "marketing_promo_codes"), newPromo);
      setShowAddPromoModal(false);
      setPromoCode("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "marketing_promo_codes");
    }
  };

  // Handle Delete Campaign
  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("هل أنت متأكد من إلغاء وحذف هذه الحملة التسويقية نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "marketing_campaigns", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketing_campaigns/${id}`);
    }
  };

  // Handle Delete Promo
  const handleDeletePromo = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الكوبون الترويجي؟")) return;
    try {
      await deleteDoc(doc(db, "marketing_promo_codes", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketing_promo_codes/${id}`);
    }
  };

  // Copywriting Template generation assistant
  const copywritingTemplates: Record<string, { title: string; audience: string; text: string }> = {
    customers_weekend: {
      title: "🍔 عروض الويك إند الحصرية للعملاء",
      audience: "العملاء والمشترين",
      text: "الخميس والجمعة واللمة محتاجة أكل يفتح النفس! 🎉 اطلب دلوقتي وجباتك المفضلة من {RestaurantName} بخصم فوري 15% مع أسرع خدمة توصيل. اضغط على الرابط واطلب في ثوانٍ: {MenuURL} 🍕🥤"
    },
    owners_recruitment: {
      title: "👑 استقطاب المطاعم الجديدة للمنصة",
      audience: "أصحاب المطاعم والملاك",
      text: "بتدفع عمولة 30% لتطبيقات التوصيل؟ 💸 حان وقت التغيير! امتلك منيو إلكتروني ذكي يحمل هويتك وشعارك واستقبل الطلبات مباشرة على رقمك بدون عمولة نهائياً! اشترك الآن مع إسلام فود وجرب مجاناً لمدة 14 يوم. 🚀"
    },
    inactive_winback: {
      title: "😢 إعادة تنشيط العملاء غير النشطين",
      audience: "العملاء السابقين",
      text: "اشتقنالك واشتاقتلك وجباتنا السخنة! 💔 استخدم كود الخصم [WE_MISS_YOU] للحصول على توصيل مجاني فوري وبدون أي شروط على وجبتك القادمة اليوم من {RestaurantName} جرب المنيو المطور واطلب الآن: {MenuURL}"
    },
    delivery_speed: {
      title: "⚡ التميز بالسرعة الساحقة لفرعك",
      audience: "عملاء فرعي نشط",
      text: "الأكل السخن طعمه أحلى لما يوصل بسرعة فائقة! 🕒 طيارين {RestaurantName} في منطقتك جاهزين ومستعدين لتوصيل وجبتك الساخنة في أقل من 25 دقيقة! تتبع طلبك لحظة بلحظة واطلب الآن: {MenuURL} 🔥"
    }
  };

  const handleApplyCopywritingTemplate = (key: string) => {
    const template = copywritingTemplates[key];
    if (!template) return;
    
    // Choose a random restaurant if available to populate placeholder
    const randRest = restaurants.length > 0 ? restaurants[Math.floor(Math.random() * restaurants.length)] : { name: "مطعم البرنس الشريك", id: "sample" };
    let finalMsg = template.text
      .replace(/{RestaurantName}/g, randRest.name)
      .replace(/{MenuURL}/g, `https://islamfood.com/menu/${randRest.id}`);
    
    setAiCustomizedText(finalMsg);
    setCampContent(finalMsg); // Link directly to the active campaign content field if the user wants to copy it
  };

  useEffect(() => {
    handleApplyCopywritingTemplate(aiSelectedTemplate);
  }, [aiSelectedTemplate, restaurants]);

  // Calculations for KPI dashboard
  const totalCampaignBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
  const activeCampaignsCount = campaigns.filter(c => c.status === "active").length;
  const totalEstimatedReach = campaigns.reduce((acc, c) => acc + c.estimatedReach, 0);
  const totalEstimatedConversions = campaigns.reduce((acc, c) => acc + c.estimatedConversions, 0);

  // Egypt Governorates Target weights (to show simulated roadmap focus)
  const governorateTargetWeights = [
    { name: "القاهرة والجيزة", restaurantsCount: restaurants.filter(r => r.address?.includes("القاهرة") || r.address?.includes("الجيزة")).length || 12, percentage: 45, color: "bg-orange-500" },
    { name: "الإسكندرية والساحل", restaurantsCount: restaurants.filter(r => r.address?.includes("الأسكندرية") || r.address?.includes("الاسكندرية")).length || 4, percentage: 20, color: "bg-blue-500" },
    { name: "القليوبية والدلتا", restaurantsCount: restaurants.filter(r => r.address?.includes("القليوبية") || r.address?.includes("المنصورة") || r.address?.includes("الغربية")).length || 5, percentage: 18, color: "bg-emerald-500" },
    { name: "الصعيد والوجه القبلي", restaurantsCount: restaurants.filter(r => r.address?.includes("المنيا") || r.address?.includes("أسيوط")).length || 2, percentage: 17, color: "bg-amber-500" }
  ];

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Upper Main Banner with subtle gradient mimicking Screenshot 1 style */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-orange-950 text-white p-6 rounded-3xl border border-slate-850 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-orange-500/20 text-orange-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-orange-500/30 uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              الاستراتيجية الكبرى والنمو المتسارع
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">الخطة التسويقية الشاملة لمنصة إسلام فود 🚀</h2>
          <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
            التحكم المطلق بمسار انتشار المنصة والترويج الجغرافي. صمّم حملاتك، تتبع الميزانيات، أطلق الكوبونات، واطلع على دليل ملاك المطاعم لتعظيم الدخل والأرباح.
          </p>
        </div>
        
        {campaigns.length === 0 && (
          <button
            onClick={handleSeedDefaultCampaigns}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs py-2.5 px-5 rounded-2xl shadow-lg shadow-orange-500/20 transition cursor-pointer flex items-center gap-2 self-start md:self-auto shrink-0"
          >
            <Bot className="w-4 h-4 animate-bounce" />
            <span>تهيئة الخطة والحملات الافتراضية ⚙️</span>
          </button>
        )}
      </div>

      {/* Modern Aesthetic Sub-Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-1.5" id="marketing_subtabs">
        <button
          onClick={() => setActiveSubTab("dashboard")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "dashboard"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>لوحة الأداء والاستراتيجية الجغرافية 📊</span>
        </button>

        <button
          onClick={() => setActiveSubTab("campaigns")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "campaigns"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>جدولة وتمويل حملات البث التلقائي 📅</span>
          {activeCampaignsCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("promos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "promos"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>كوبونات الخصم الشاملة للمنصة 🏷️</span>
        </button>

        <button
          onClick={() => setActiveSubTab("vault")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "vault"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>بنك الأفكار الترويجية ودليل النجاح 💡</span>
        </button>

        <button
          onClick={() => setActiveSubTab("agents")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "agents"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>إدارة مناديب التسويق والعمولات 👥</span>
        </button>
      </div>

      {/* SUB-TAB 1: ROADMAP & KPI DASHBOARD */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics Block */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-lg space-y-2">
              <span className="text-[10px] font-black text-slate-400 block uppercase">مجموع ميزانية التسويق المعتمدة</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono">{totalCampaignBudget.toLocaleString()}</span>
                <span className="text-[10px] text-orange-400 font-bold">ج.م شهرياً</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full w-[65%]" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black text-slate-400 block uppercase">الحملات الترويجية النشطة</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-slate-950">{activeCampaignsCount}</span>
                <span className="text-[10px] text-emerald-600 font-bold">حملات حية ✅</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[80%]" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black text-slate-400 block uppercase">الوصول المتوقع الكلي لجمهور مصر</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-slate-950">{(totalEstimatedReach || 60000).toLocaleString()}</span>
                <span className="text-[10px] text-indigo-600 font-bold">مشاهدة مستهدفة</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[45%]" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black text-slate-400 block uppercase">التحويلات المتوقعة لطلبات واشتراكات</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-slate-950">{(totalEstimatedConversions || 2300).toLocaleString()}</span>
                <span className="text-[10px] text-orange-600 font-bold">تحويل فعلي</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full w-[55%]" />
              </div>
            </div>
          </div>

          {/* Marketing Channels Performance Benchmark & Geographics Targets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Start 2/3 block: Channels comparison list */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  مقارنة قنوات البث التسويقي في مصر ومعدل استجابتها
                </h3>
                <p className="text-[10px] text-slate-400">توزيع الكفاءة المتوقعة بناءً على تجارب تشغيل فروع مطاعم المنظومة الحقيقية.</p>
              </div>

              <div className="space-y-4">
                {marketingChannels.map((channel, idx) => (
                  <div key={idx} className="border border-slate-100 rounded-2xl p-3.5 hover:bg-slate-50 transition duration-150 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-800">{channel.name}</span>
                      <div className="flex gap-3 text-[10px] font-mono">
                        <span className="text-slate-500">تكلفة الألف وصول: <strong className="text-slate-900">{channel.costPerMil} ج.م</strong></span>
                        <span className="text-emerald-600 font-bold">معدل التحويل (CTR): <strong>{(channel.avgCtr * 100)}%</strong></span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">{channel.desc}</p>
                    
                    {/* Simulated visual bar for CTR power */}
                    <div className="relative w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="absolute h-full bg-orange-500 rounded-full transition-all duration-300" 
                        style={{ width: `${(channel.avgCtr / 0.18) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right/End 1/3 block: Governorates weights */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-orange-500" />
                  التركيز الجغرافي المستهدف بالخطة
                </h3>
                <p className="text-[10px] text-slate-400">نسبة تركيز التمويل الإعلاني حسب المحافظات.</p>
              </div>

              <div className="space-y-4">
                {governorateTargetWeights.map((weight, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-extrabold text-slate-800">{weight.name}</span>
                      <span className="font-bold text-slate-500">{weight.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div className={`${weight.color} h-full rounded-full`} style={{ width: `${weight.percentage}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>التركيز المالي المستهدف</span>
                      <span>{weight.restaurantsCount} مطعم فرعي نشط حالياً بالمنظومة</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-orange-50 border border-orange-100/55 rounded-2xl p-3.5 text-xs text-orange-950 leading-relaxed">
                <p className="font-extrabold text-[11px] mb-1">💡 توجيه ذكي للمسوقين:</p>
                يركز التمويل الحالي بشكل مكثف على إقليم القاهرة الكبرى لزيادة القوة الشرائية ورفع نسب استجابة المطاعم ومحاكاة البث التلقائي.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CAMPAIGNS SCHEDULER */}
      {activeSubTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-900">جدولة وتمويل وإدارة الحملات الإعلانية 📅</h3>
              <p className="text-[10px] text-slate-400">أضف خطتك الإعلانية القادمة، وحدد الميزانية والجمهور لتقدير وتحقيق المبيعات تلقائياً.</p>
            </div>
            <button
              onClick={() => setShowAddCampaignModal(true)}
              className="bg-slate-900 hover:bg-slate-950 text-white font-black text-xs py-2 px-4 rounded-xl shadow transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>إطلاق حملة تسويقية جديدة</span>
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل سجل الحملات التسويقية النشطة...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-800 text-xs">لا توجد حملات تسويقية مجدولة حالياً</p>
              <p className="text-[10px] text-slate-400 mt-1">اضغط على "تهيئة الخطة والحملات الافتراضية" بالأعلى أو أنشئ حملة ترويجية ممتازة الآن!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <div 
                  key={camp.id} 
                  className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                        {camp.channel}
                      </span>
                      <button
                        onClick={() => camp.id && handleDeleteCampaign(camp.id)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="font-black text-slate-900 text-xs leading-relaxed">{camp.name}</h4>
                    
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>الميزانية: <strong className="text-slate-900 font-mono">{camp.budget} ج.م</strong></span>
                      <span>•</span>
                      <span>الجمهور: 
                        <strong className="text-slate-950 font-sans mr-1">
                          {camp.targetAudience === "all" && "الجميع 👥"}
                          {camp.targetAudience === "owners" && "أصحاب المطاعم 👑"}
                          {camp.targetAudience === "customers" && "العملاء والمستهلكين 🍔"}
                        </strong>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed font-sans font-medium">
                      {camp.content}
                    </p>
                  </div>

                  {/* Estimated simulated impact footer */}
                  <div className="bg-orange-50/40 p-3 rounded-2xl border border-orange-100/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">الوصول الجغرافي المقدر</span>
                      <span className="text-xs font-black text-slate-900 font-mono">{(camp.estimatedReach || 20000).toLocaleString()} مشاهد</span>
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] text-slate-400 block font-bold">التفاعل والتحويل المتوقع</span>
                      <span className="text-xs font-black text-emerald-600 font-mono">+{(camp.estimatedConversions || 400).toLocaleString()} طلب واشتراك</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADD CAMPAIGN MODAL */}
          {showAddCampaignModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-lg w-full space-y-4 animate-scale-up text-right max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-black text-slate-950 text-base">إضافة حملة تسويقية ممولة مجدولة 🚀</h3>
                  <button onClick={() => setShowAddCampaignModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-600 font-black mb-1">اسم الحملة التسويقية</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: حملة تخفيضات صيف 2026 الكبرى"
                      value={campName}
                      onChange={(e) => setCampName(e.target.value)}
                      className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-black mb-1">قناة البث التسويقي</label>
                      <select
                        value={campChannel}
                        onChange={(e) => setCampChannel(e.target.value)}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-bold"
                      >
                        {marketingChannels.map((c, i) => (
                          <option key={i} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-black mb-1">الجمهور المستهدف</label>
                      <select
                        value={campAudience}
                        onChange={(e) => setCampAudience(e.target.value as any)}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-bold"
                      >
                        <option value="all">الجميع بالمنظومة (عملاء وملاك) 👥</option>
                        <option value="owners">ملاك المطاعم الشريكة فقط 👑</option>
                        <option value="customers">العملاء ومستخدمي المنيو فقط 🍔</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 font-black mb-1">تاريخ البدء</label>
                      <input
                        type="date"
                        value={campStart}
                        onChange={(e) => setCampStart(e.target.value)}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-black mb-1">تاريخ الانتهاء</label>
                      <input
                        type="date"
                        value={campEnd}
                        onChange={(e) => setCampEnd(e.target.value)}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-black mb-1">الميزانية المقترحة (ج.م)</label>
                      <input
                        type="number"
                        min={100}
                        max={100000}
                        value={campBudget}
                        onChange={(e) => setCampBudget(Number(e.target.value))}
                        className="w-full text-xs border rounded-xl py-2 px-3 bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-black mb-1">الهدف الاستراتيجي من الحملة</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: زيادة معدل تنشيط العملاء السابقين ورفع عدد الأوردرات"
                      value={campObjective}
                      onChange={(e) => setCampObjective(e.target.value)}
                      className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-black mb-1">نص الإعلان والرسالة الترويجية المقترحة 📝</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="اكتب المحتوى الجذاب للعميل هنا..."
                      value={campContent}
                      onChange={(e) => setCampContent(e.target.value)}
                      className="w-full text-xs border rounded-2xl py-2.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-sans font-medium resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddCampaignModal(false)}
                      className="px-4 py-2 rounded-xl border font-bold text-slate-500 hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black"
                    >
                      إطلاق وجدولة الحملة 🚀
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: PROMO CODES */}
      {activeSubTab === "promos" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-900">أكواد الخصم الترويجية الشاملة للمنصة 🏷️</h3>
              <p className="text-[10px] text-slate-400">تمنح هذه الأكواد خصومات مباشرة عند إدخالها بواسطة المشترين في شاشة إكمال الطلب بالمنيو.</p>
            </div>
            <button
              onClick={() => setShowAddPromoModal(true)}
              className="bg-slate-900 hover:bg-slate-950 text-white font-black text-xs py-2 px-4 rounded-xl shadow transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء كود خصم جديد</span>
            </button>
          </div>

          {loadingPromos ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400 font-bold">جاري تحميل أكواد الكوبونات الحية...</p>
            </div>
          ) : promos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
              <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-800 text-xs">لا توجد أكواد خصم نشطة حالياً</p>
              <p className="text-[10px] text-slate-400 mt-1">اضغط على "تهيئة الخطة والحملات الافتراضية" بالأعلى لزراعة الأكواد فوراً!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {promos.map((pr) => (
                <div 
                  key={pr.id} 
                  className="bg-white border-2 border-dashed border-slate-200 hover:border-orange-300 rounded-3xl p-5 transition duration-150 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm font-black tracking-widest bg-orange-50 text-orange-600 px-3 py-1 rounded-xl border border-orange-200">
                        {pr.code}
                      </span>
                      <button
                        onClick={() => pr.id && handleDeletePromo(pr.id)}
                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-450 font-bold">قيمة الخصم:</span>
                        <span className="text-slate-900 font-black text-sm">{pr.discountPercentage}% خصم فوري</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450 font-bold">معدل الاستخدام:</span>
                        <span className="text-slate-900 font-bold font-mono">
                          {pr.currentUses} / {pr.maxUses} عميل
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-450 font-bold">تاريخ الصلاحية:</span>
                        <span className="text-slate-500 font-mono font-bold">{pr.expiryDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      نشط ويعمل بالمنيو ✅
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pr.code);
                        alert(`📋 تم نسخ كود الخصم "${pr.code}" بنجاح! جاهز للنشر والمشاركة.`);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold transition"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>نسخ الكود</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADD PROMO MODAL */}
          {showAddPromoModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-4 animate-scale-up text-right">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-black text-slate-950 text-sm">إنشاء كود كوبون خصم جديد 🏷️</h3>
                  <button onClick={() => setShowAddPromoModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreatePromo} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-600 font-black mb-1">كود الكوبون (بالأحرف الإنجليزية)</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: SUMMER20"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white focus:outline-none focus:border-orange-500 font-mono font-black tracking-widest text-left"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-black mb-1">نسبة الخصم (%)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={100}
                        value={promoDiscount}
                        onChange={(e) => setPromoDiscount(Number(e.target.value))}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-black mb-1">الحد الأقصى للاستخدام</label>
                      <input
                        type="number"
                        required
                        min={10}
                        max={5000}
                        value={promoMaxUses}
                        onChange={(e) => setPromoMaxUses(Number(e.target.value))}
                        className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-black mb-1">تاريخ انتهاء الصلاحية</label>
                    <input
                      type="date"
                      value={promoExpiry}
                      onChange={(e) => setPromoExpiry(e.target.value)}
                      className="w-full text-xs border rounded-xl py-2.5 px-3 bg-white font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddPromoModal(false)}
                      className="px-4 py-2 rounded-xl border font-bold text-slate-500"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black"
                    >
                      حفظ وتنشيط 🏷️
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: GROWTH VAULT & PRINTABLE GUIDE */}
      {activeSubTab === "vault" && (
        <div className="space-y-6">
          {/* Top section: AI assistant copywriting simulation */}
          <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-orange-500 animate-bounce" />
              <h3 className="font-extrabold text-slate-900 text-sm">مساعد الصياغة الترويجية الإبداعية وبث المحتوى الذكي 🤖</h3>
            </div>
            <p className="text-[10px] text-slate-500">
              اختر أحد القوالب الجاهزة لصياغة إشعار ترويجي، وقم بنسخه وتعديله لبدء البث المباشر للعملاء وأصحاب المطاعم.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Template selector column */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">اختر نوع قالب الصياغة المستهدف:</label>
                <div className="space-y-1.5">
                  {Object.keys(copywritingTemplates).map((key) => (
                    <button
                      key={key}
                      onClick={() => setAiSelectedTemplate(key)}
                      className={`w-full text-right p-2.5 rounded-xl text-[11px] font-black border transition duration-150 flex items-center justify-between ${
                        aiSelectedTemplate === key
                          ? "bg-orange-500 border-orange-600 text-white shadow"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span>{copywritingTemplates[key].title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${aiSelectedTemplate === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {copywritingTemplates[key].audience}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Output result 2 columns width */}
              <div className="md:col-span-2 space-y-2 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700">المحتوى الترويجي المولد والمهيأ للبث الفوري 📝</label>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 min-h-[100px] text-xs leading-relaxed font-sans font-medium text-slate-800">
                    {aiCustomizedText}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiCustomizedText);
                      alert("📋 تم نسخ النص الترويجي المولد بنجاح!");
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition"
                  >
                    نسخ النص الترويجي
                  </button>
                  <button
                    onClick={() => {
                      // Trigger direct alert in client
                      const customEvent = new CustomEvent("islamfood_new_tip_alert", { detail: aiCustomizedText });
                      window.dispatchEvent(customEvent);
                      alert("🚀 تم محاكاة بث هذا الإشعار الإعلاني الذكي فورياً لكافة العملاء النشطين عبر المنظومة بنجاح!");
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black py-2 px-5 rounded-xl text-xs transition shadow-sm shadow-orange-500/10"
                  >
                    🚀 تجربة بث الإشعار فورياً الآن
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Egypt Modern Restaurant Growth Manual */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4" id="printable-success-manual">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-slate-900 text-sm">كتيب ودليل نجاح المطاعم الشامل في مصر 📚</h3>
              </div>
              <button
                onClick={() => {
                  const printArea = document.getElementById("printable-success-manual");
                  if (!printArea) return;
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html dir="rtl" lang="ar">
                        <head>
                          <title>دليل نجاح المطاعم الشريك - إسلام فود</title>
                          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                          <script src="https://cdn.tailwindcss.com"></script>
                          <style>body { font-family: 'Cairo', sans-serif; padding: 40px; }</style>
                        </head>
                        <body>
                          ${printArea.innerHTML}
                          <script>
                            window.onload = function() { window.print(); setTimeout(() => { window.close(); }, 500); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }}
                className="bg-orange-50 hover:bg-orange-100 text-orange-600 font-extrabold text-[10px] py-1 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer no-print"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الدليل الترويجي 📥</span>
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    استراتيجية المنيو الجغرافي الذكي QR
                  </h4>
                  <p className="text-slate-600">
                    ضع الكود المخصص بموقعك على طاولات الصالون، زجاج المحل، وعلى كروت التعبئة. الصورة الواحدة تزيد احتمال طلب الصنف بنسبة 45%. خطط أسبوعية: ارفع صور حقيقية عالية الجودة مع تفاصيل واضحة وسعر دقيق للمستهلك لتقليل الهدر ومكالمات الاستفسار.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    تحفيز الطلبات المباشرة وتقليل عمولات الوسطاء
                  </h4>
                  <p className="text-slate-600">
                    وجّه عملاءك دائمًا للطلب عبر رابط المنظومة الذكية مباشرة بتقديم عروض توصيل مخفضة أو هدايا حصرية. كل طلب عبر منيو المنصة يوفر عليك ما يصل إلى 30% عمولة للتطبيقات الكبرى الأخرى، ويحفظ البيانات الكاملة للعميل لإرسال عروض مجددة.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    التواصل اللحظي وبناء ولاء مستدام بالدردشة
                  </h4>
                  <p className="text-slate-600">
                    الشات المباشر مع المطبخ يوفر على العميل عناء المكالمات التليفونية ويخلق علاقة حميمية ممتازة. فصّل الملاحظات بذكاء وأعط العميل انطباعًا أن وجبته تصنع بشغف وحب واهتمام، وهو ما يرفع من معدل تقييم الفروع على الخرائط بنسب تتعدى 200%.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    نظام الكوبونات ونشر الأكواد المؤقتة
                  </h4>
                  <p className="text-slate-600">
                    الأكواد الترويجية مثل (LUNCH50 أو DINNER) تدفع المترددين لإجراء عملية الشراء الأولى فوراً. استخدم ميزة تدوير الكوبونات بذكاء في مواسم الأعياد وعطلات الويك إند لضمان تشغيل المطبخ بالطاقة القصوى وتعزيز الإنتاجية والانتشار.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: EXISTING PARTNERS & COMMISSIONS */}
      {activeSubTab === "agents" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 text-right font-sans" dir="rtl">
            <div className="border-b pb-3 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-850 flex items-center gap-2">
                  🚀 إدارة المندوبين والشركاء الماليين للمطاعم
                </h3>
                <p className="text-[10px] text-slate-400">تابع مسؤولي المبيعات، ومعدل عمولات الاشتراكات المحققة شهرياً لكل علامة تجارية مسجلة.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">اختر المطعم للمتابعة:</span>
                <select
                  value={selectedRestaurantId || ""}
                  onChange={(e) => setSelectedRestaurantId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-right outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="">-- اختر مطعماً للمتابعة --</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedRestaurantId ? (
              (() => {
                const targetRest = restaurants.find(r => r.id === selectedRestaurantId);
                return targetRest ? (
                  <MarketingAgentsTab restaurant={targetRest} />
                ) : (
                  <p className="text-center text-xs text-slate-400 py-12">عذراً، المطعم المحدد غير موجود.</p>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full text-slate-400 space-y-2">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-2xl mb-2">
                  👥
                </div>
                <p className="text-xs font-black text-slate-700">لم يتم اختيار مطعم</p>
                <p className="text-[10px] text-slate-450 max-w-[65%] leading-normal mx-auto">
                  يرجى تحديد مطعم من القائمة المنسدلة في الأعلى لاستعراض وإدارة مندوبيه ومسوقيه ومتابعة إحصائياتهم ونسب عمولاتهم.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
