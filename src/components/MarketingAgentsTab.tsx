import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, onSnapshot 
} from "firebase/firestore";
import { 
  Users, Plus, Search, Filter, Trash2, Edit2, Download, Percent, Award, Target, 
  MapPin, Calendar, Clock, AlertTriangle, ArrowRight, UserPlus, Phone, Map, DollarSign,
  TrendingUp, RefreshCw, FileText, Check, X, Printer, Sparkles, Trophy
} from "lucide-react";
import { Restaurant, MarketingAgent } from "../types";

interface MarketingAgentsTabProps {
  restaurant: Restaurant;
}

export default function MarketingAgentsTab({ restaurant }: MarketingAgentsTabProps) {
  const [agents, setAgents] = useState<MarketingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGovernorate, setSelectedGovernorate] = useState("all");
  
  // Form states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(25);
  const [address, setAddress] = useState("");
  const [governorate, setGovernorate] = useState("القاهرة");
  const [monthlySubs, setMonthlySubs] = useState<number>(0);
  const [commissionPct, setCommissionPct] = useState<number>(10);
  const [targetSubs, setTargetSubs] = useState<number>(15);

  // PDF Report State
  const [selectedReportAgent, setSelectedReportAgent] = useState<MarketingAgent | null>(null);
  const [reportStartDate, setReportStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // List of Egyptian Governorates for dropdowns
  const governorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الغربية", 
    "الشرقية", "المنوفية", "دمياط", "بورسعيد", "السويس", "الإسماعيلية", 
    "البحر الأحمر", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", 
    "قنا", "الأقصر", "أسوان", "شمال سيناء", "جنوب سيناء", "مطروح", "الوادي الجديد"
  ];

  // Fetch agents real-time
  useEffect(() => {
    setLoading(true);
    const path = `restaurants/${restaurant.id}/marketing_agents`;
    const colRef = collection(db, "restaurants", restaurant.id, "marketing_agents");
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: MarketingAgent[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MarketingAgent);
      });
      setAgents(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant.id]);

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingAgentId(null);
    setName("");
    setAge(25);
    setAddress("");
    setGovernorate("القاهرة");
    setMonthlySubs(0);
    setCommissionPct(10);
    setTargetSubs(15);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (agent: MarketingAgent) => {
    setIsEditMode(true);
    setEditingAgentId(agent.id);
    setName(agent.name);
    setAge(agent.age);
    setAddress(agent.address);
    setGovernorate(agent.governorate);
    setMonthlySubs(agent.monthlySubscriptionsCount);
    setCommissionPct(agent.commissionPercentage || 10);
    setTargetSubs(agent.targetSubscriptions || 15);
    setIsAddModalOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      alert("الرجاء تعبئة البيانات الأساسية للمندوب");
      return;
    }

    const path = `restaurants/${restaurant.id}/marketing_agents`;
    
    try {
      if (isEditMode && editingAgentId) {
        const docRef = doc(db, "restaurants", restaurant.id, "marketing_agents", editingAgentId);
        await updateDoc(docRef, {
          name,
          age: Number(age),
          address,
          governorate,
          monthlySubscriptionsCount: Number(monthlySubs),
          commissionPercentage: Number(commissionPct),
          targetSubscriptions: Number(targetSubs),
        });
      } else {
        const colRef = collection(db, "restaurants", restaurant.id, "marketing_agents");
        await addDoc(colRef, {
          restaurantId: restaurant.id,
          name,
          age: Number(age),
          address,
          governorate,
          monthlySubscriptionsCount: Number(monthlySubs),
          commissionPercentage: Number(commissionPct),
          targetSubscriptions: Number(targetSubs),
          registeredAt: new Date().toISOString(),
        });
      }
      setIsAddModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المندوب نهائياً؟")) return;
    const path = `restaurants/${restaurant.id}/marketing_agents/${id}`;
    try {
      const docRef = doc(db, "restaurants", restaurant.id, "marketing_agents", id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Helper calculation for agent financials & badges
  const getAgentFinancials = (agent: MarketingAgent) => {
    const defaultSubscriptionFee = 1500; // Estimated platform subscription price per month
    const broughtCount = agent.monthlySubscriptionsCount || 0;
    const commissionRate = (agent.commissionPercentage || 10) / 100;
    const target = agent.targetSubscriptions || 15;

    // Financial calculations
    const baseCommission = broughtCount * defaultSubscriptionFee * commissionRate;
    
    // Incentive system
    // Gold: Exceeded target -> 1200 EGP bonus
    // Silver: Met target -> 500 EGP bonus
    // Bronze: Under target -> No bonus
    let bonus = 0;
    let rank = "مبتدئ 🌟";
    let rankColor = "text-amber-700 bg-amber-50 border-amber-250";
    
    if (broughtCount >= target) {
      bonus = 1200;
      rank = "بطل التسويق الذهبى 🏆";
      rankColor = "text-yellow-700 bg-yellow-50 border-yellow-200";
    } else if (broughtCount >= Math.floor(target * 0.6)) {
      bonus = 500;
      rank = "مندوب فضي متألق ✨";
      rankColor = "text-slate-700 bg-slate-50 border-slate-200";
    }

    const totalPayout = baseCommission + bonus;

    return {
      baseCommission,
      bonus,
      totalPayout,
      rank,
      rankColor,
      progress: Math.min(Math.round((broughtCount / target) * 100), 100)
    };
  };

  // Filter & Search Agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          agent.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.governorate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGov = selectedGovernorate === "all" || agent.governorate === selectedGovernorate;
    return matchesSearch && matchesGov;
  });

  // Print PDF logic
  const handlePrintReport = () => {
    const printContent = document.getElementById("pdf-report-print-area");
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl" lang="ar">
          <head>
            <title>تقرير أداء مندوب التسويق - ${selectedReportAgent?.name}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body {
                font-family: 'Cairo', 'Inter', sans-serif;
                padding: 40px;
                background-color: white;
              }
              @media print {
                .no-print { display: none; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body class="bg-white">
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-6 h-6 animate-pulse" />
            <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">نظام الشركاء والمندوبين</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black">إدارة مناديب ومسوقي نظام المطعم الذكي 🚀</h2>
          <p className="text-xs text-orange-50/90 font-medium max-w-xl mt-1 leading-relaxed">
            قم بإضافة ومتابعة المسوقين لعلامتك التجارية، وحدد الحوافز والعمولات لكل اشتراك شهري جديد لزيادة رقعة انتشار مطعمك وإصدار تقارير الأداء التفصيلية.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-white text-orange-600 hover:bg-orange-50 font-black px-5 py-3 rounded-2xl shadow-lg hover:shadow-xl transition duration-150 flex items-center gap-2 shrink-0 active:scale-95 text-xs border border-orange-100"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مندوب تسويق جديد</span>
        </button>
      </div>

      {/* Incentives Summary Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-amber-600" />
          <h3 className="font-extrabold text-slate-950 text-sm">نظام تحفيز المندوبين المتطور 🎁</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
            <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-0.5">عمولة أساسية ممتازة</h4>
              <p className="text-slate-500 leading-relaxed">تُحسب نسبة مئوية (مثال: 10%) من قيمة اشتراك المنصة الشهري للمطاعم المحالة.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
            <div className="bg-slate-100 p-2.5 rounded-xl text-slate-700">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-0.5">مكافأة الفئة الفضية</h4>
              <p className="text-slate-500 leading-relaxed">بونص نقدي إضافي بقيمة <strong>500 ج.م</strong> بمجرد تحقيق 60% من تارجت الاشتراكات الشهري.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
            <div className="bg-yellow-100 p-2.5 rounded-xl text-yellow-700">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-0.5">المكافأة الذهبية الكبرى</h4>
              <p className="text-slate-500 leading-relaxed">بونص إضافي بقيمة <strong>1200 ج.م</strong> مع درع بطل التسويق عند تحقيق التارجت كاملاً.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث عن مندوب بالاسم، العنوان، المحافظة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs border rounded-xl py-2.5 pr-9 pl-3 focus:outline-none focus:border-orange-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGovernorate}
              onChange={(e) => setSelectedGovernorate(e.target.value)}
              className="text-xs bg-transparent border-none focus:outline-none pr-1 cursor-pointer font-bold text-slate-700"
            >
              <option value="all">كل المحافظات</option>
              {governorates.map((gov) => (
                <option key={gov} value={gov}>{gov}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">جاري تحميل بيانات المندوبين المتصلين بالخادم...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="bg-slate-50 p-4 rounded-full mb-3">
            <Users className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="font-black text-slate-800 text-sm">لا يوجد مناديب تسويق مسجلين حالياً</h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm px-4">
            قم بالضغط على زر "إضافة مندوب تسويق جديد" في الأعلى للبدء في تعبئة طاقم التسويق والمتابعة الحية لنسب الإنجاز الشهرية.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => {
            const financials = getAgentFinancials(agent);
            return (
              <div 
                key={agent.id}
                className="bg-white border border-slate-100 hover:border-orange-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top header of agent card */}
                  <div className="flex justify-between items-start gap-2 mb-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm">{agent.name}</h4>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${financials.rankColor}`}>
                          {financials.rank}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[10px] mt-1 font-semibold">
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {agent.governorate} - {agent.address}
                        </span>
                        <span>•</span>
                        <span>العمر: {agent.age} سنة</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(agent)}
                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                        title="تعديل بيانات المندوب"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReportAgent(agent);
                          setIsReportModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="أداء المندوب / طباعة تقرير"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="حذف المندوب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body Metrics */}
                  <div className="grid grid-cols-3 gap-2.5 text-center mb-4">
                    <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-bold mb-0.5">الاشتراكات المحققة</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{agent.monthlySubscriptionsCount}</span>
                    </div>
                    <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-bold mb-0.5">معدل العمولة المتفق</span>
                      <span className="text-sm font-black text-orange-600 font-mono">{agent.commissionPercentage || 10}%</span>
                    </div>
                    <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 block font-bold mb-0.5">الهدف الشهري (تارجت)</span>
                      <span className="text-sm font-black text-slate-500 font-mono">{agent.targetSubscriptions || 15}</span>
                    </div>
                  </div>

                  {/* Target progress bar */}
                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>إنجاز الهدف الشهري</span>
                      <span className="text-orange-600 font-mono">{financials.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${financials.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer calculations */}
                <div className="bg-orange-50/40 p-3 rounded-2xl border border-orange-100/50 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold">إجمالي مستحقات المندوب</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {(financials.totalPayout).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="text-left text-[10px] text-slate-400">
                    <div>العمولة: <span className="font-mono text-slate-700 font-bold">{financials.baseCommission} ج.م</span></div>
                    {financials.bonus > 0 && (
                      <div className="text-green-600 font-bold">الحافز: <span className="font-mono">+{financials.bonus} ج.م</span></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Agent Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-lg w-full space-y-4 animate-scale-up text-right max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-950 text-base">
                {isEditMode ? "تعديل بيانات مندوب التسويق" : "إضافة مندوب تسويق جديد 👤"}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-black mb-1.5">الاسم الكامل للمندوب</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد علي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-black mb-1.5">العمر (سنوات)</label>
                  <input
                    type="number"
                    required
                    min={18}
                    max={80}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-black mb-1.5">المحافظة</label>
                  <select
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                  >
                    {governorates.map((gov) => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-black mb-1.5">العنوان السكني التفصيلي</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شارع جامعة الدول العربية - المهندسين"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs border rounded-xl py-2.5 px-3 focus:outline-none focus:border-orange-500 bg-white"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-3">
                <span className="font-black text-slate-800 text-[11px] block border-b border-slate-200/60 pb-1 mb-2">إعدادات العمولة والتارجت الشهري 🎯</span>
                
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">الاشتراكات الحالية</label>
                    <input
                      type="number"
                      min={0}
                      value={monthlySubs}
                      onChange={(e) => setMonthlySubs(Number(e.target.value))}
                      className="w-full text-xs border rounded-xl py-2 px-2.5 focus:outline-none focus:border-orange-500 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">التارجت المستهدف</label>
                    <input
                      type="number"
                      min={1}
                      value={targetSubs}
                      onChange={(e) => setTargetSubs(Number(e.target.value))}
                      className="w-full text-xs border rounded-xl py-2 px-2.5 focus:outline-none focus:border-orange-500 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">نسبة العمولة (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={commissionPct}
                      onChange={(e) => setCommissionPct(Number(e.target.value))}
                      className="w-full text-xs border rounded-xl py-2 px-2.5 focus:outline-none focus:border-orange-500 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border font-bold text-slate-500 hover:bg-slate-50 text-[11px] transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-[11px] shadow-md hover:shadow-lg transition"
                >
                  {isEditMode ? "حفظ التعديلات" : "إضافة المندوب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Report Generation Modal */}
      {isReportModalOpen && selectedReportAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-2xl w-full space-y-4 animate-scale-up text-right max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-950 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>إصدار تقرير الأداء ومستحقات المندوب 📊</span>
              </h3>
              <button 
                onClick={() => {
                  setIsReportModalOpen(false);
                  setSelectedReportAgent(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interval specifiers */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <span className="font-black text-slate-800 block">حدد الفترة الزمنية للتقرير:</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">تاريخ البدء</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Print Area Preview */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-white overflow-hidden shadow-sm" id="pdf-report-print-area">
              <div className="space-y-6 text-right" dir="rtl">
                {/* Header of Report */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900">{restaurant.name}</h1>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">نظام إدارة المطعم الذكي - تقرير المسوق الشريك</p>
                    <p className="text-[10px] text-slate-400 font-semibold">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full border border-slate-200">تقرير رسمي</span>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Ref: {selectedReportAgent.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                </div>

                {/* Agent Profile Block */}
                <div>
                  <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-1 mb-2">بيانات المندوب:</h3>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-600">
                    <div>اسم المندوب: <strong className="text-slate-900">{selectedReportAgent.name}</strong></div>
                    <div>المحافظة والمنطقة: <strong className="text-slate-900">{selectedReportAgent.governorate} - {selectedReportAgent.address}</strong></div>
                    <div>العمر: <strong className="text-slate-900 font-mono">{selectedReportAgent.age} سنة</strong></div>
                    <div>تاريخ التسجيل بالمنصة: <strong className="text-slate-900 font-mono">
                      {selectedReportAgent.registeredAt ? new Date(selectedReportAgent.registeredAt).toLocaleDateString('ar-EG') : "غير محدد"}
                    </strong></div>
                  </div>
                </div>

                {/* Period description */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                  الفترة الزمنية للتقرير: من <strong className="font-mono text-slate-950">{reportStartDate}</strong> إلى <strong className="font-mono text-slate-950">{reportEndDate}</strong>
                </div>

                {/* Table metrics */}
                <div>
                  <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-1 mb-2.5">إحصائيات الأداء والمستحقات بالفترة:</h3>
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="p-2 border border-slate-200 font-black">البيان / المؤشر</th>
                        <th className="p-2 border border-slate-200 font-black text-center">الكمية / النسبة</th>
                        <th className="p-2 border border-slate-200 font-black text-left">العائد المالي المستحق</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-200 font-semibold">الاشتراكات المحالة والمفعّلة</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">{selectedReportAgent.monthlySubscriptionsCount}</td>
                        <td className="p-2 border border-slate-200 text-left font-mono text-slate-500">
                          {(selectedReportAgent.monthlySubscriptionsCount * 1500).toLocaleString()} ج.م (قيمة إجمالية)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200 font-semibold">قيمة العمولة الأساسية للمندوب</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">{selectedReportAgent.commissionPercentage || 10}%</td>
                        <td className="p-2 border border-slate-200 text-left font-mono font-bold text-slate-900">
                          {getAgentFinancials(selectedReportAgent).baseCommission.toLocaleString()} ج.م
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200 font-semibold">بونص الحافز الإضافي الفئة</td>
                        <td className="p-2 border border-slate-200 text-center font-bold">
                          {getAgentFinancials(selectedReportAgent).rank}
                        </td>
                        <td className="p-2 border border-slate-200 text-left font-mono font-bold text-green-600">
                          +{getAgentFinancials(selectedReportAgent).bonus.toLocaleString()} ج.م
                        </td>
                      </tr>
                      <tr className="bg-orange-50 font-black">
                        <td className="p-2 border border-slate-200 text-orange-950 font-black" colSpan={2}>صافي المستحقات الإجمالية</td>
                        <td className="p-2 border border-slate-200 text-left font-mono text-base text-orange-600">
                          {getAgentFinancials(selectedReportAgent).totalPayout.toLocaleString()} ج.م
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sign-offs */}
                <div className="pt-10 flex justify-between items-center text-xs text-slate-400">
                  <div className="text-center">
                    <p className="mb-8 text-slate-600 font-bold">توقيع إدارة المطعم</p>
                    <p className="border-t border-slate-300 pt-1.5 w-32 mx-auto">إمضاء: ________________</p>
                  </div>
                  <div className="text-center">
                    <p className="mb-8 text-slate-600 font-bold">اعتماد مسؤول المراجعة بالمنصة</p>
                    <p className="border-t border-slate-300 pt-1.5 w-32 mx-auto">إمضاء: ________________</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setSelectedReportAgent(null);
                }}
                className="px-4 py-2.5 rounded-xl border font-bold text-slate-500 hover:bg-slate-50 transition"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md hover:shadow-lg transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير / تحميل PDF 📥</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
