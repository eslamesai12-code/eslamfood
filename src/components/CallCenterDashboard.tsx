import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { 
  collection, doc, getDoc, getDocs, updateDoc, setDoc,
  query, where, onSnapshot, deleteDoc, addDoc 
} from "firebase/firestore";
import { 
  Inbox, MessageSquare, Users, Settings, LogOut, ChefHat, 
  Clock, Plus, X, Send, TrendingUp, Sparkles, Shield, 
  Check, AlertTriangle, ToggleLeft, ToggleRight, Trash2, Edit2, ShieldAlert
} from "lucide-react";
import { Restaurant, MenuItem, Order, CallCenterMember } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface CallCenterDashboardProps {
  member: CallCenterMember;
  restaurant: Restaurant;
  onLogout: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent';
  senderName: string;
  text: string;
  createdAt: string;
}

export default function CallCenterDashboard({ member, restaurant, onLogout }: CallCenterDashboardProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "team" | "menu" | "hours">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [teamMembers, setTeamMembers] = useState<CallCenterMember[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Chat overlay state
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Search/Filter states
  const [orderFilter, setOrderFilter] = useState<Order["status"] | "all">("all");
  const [agentAssignTarget, setAgentAssignTarget] = useState<{ [orderId: string]: string }>({});

  // Cancellation Modal
  const [cancellationOrderId, setCancellationOrderId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Add/Edit Team Member Modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMemberEmail, setEditingMemberEmail] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as CallCenterMember["role"]
  });

  // Synthesize buzzer/ringer alarm tone for new orders
  const playAlarmTone = () => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0.3, now);
      mainGain.connect(ctx.destination);

      const playPluck = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + startOffset);
        
        gainNode.gain.setValueAtTime(0, now + startOffset);
        gainNode.gain.linearRampToValueAtTime(1, now + startOffset + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

        osc.connect(gainNode);
        gainNode.connect(mainGain);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.1);
      };

      // Play double-beep alarm
      playPluck(880, 0, 0.12);
      playPluck(880, 0.18, 0.12);
    } catch (e) {
      console.warn("Audio Context beep blocked or failed", e);
    }
  };

  // Repetitive phone ringer effect when there are pending orders
  useEffect(() => {
    let intervalId: any = null;
    const hasPendingOrders = orders.some(o => o.status === "pending");

    if (hasPendingOrders && !isMuted) {
      // Repetitive ring every 4 seconds so that agents don't miss anything!
      playAlarmTone();
      intervalId = setInterval(() => {
        playAlarmTone();
      }, 4000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [orders, isMuted]);

  // 1. Sync Orders of the Restaurant
  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurant.id)
    );

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((doc) => {
        orderList.push({ ...doc.data() as Order, id: doc.id });
      });
      // Sort oldest first for pending workflow, descending for overall
      orderList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(orderList);
    });

    return () => unsub();
  }, [restaurant.id]);

  // 2. Sync Team Members of the Restaurant
  useEffect(() => {
    const teamQuery = query(
      collection(db, "call_center_members"),
      where("restaurantId", "==", restaurant.id)
    );

    const unsub = onSnapshot(teamQuery, (snapshot) => {
      const members: CallCenterMember[] = [];
      snapshot.forEach((doc) => {
        members.push(doc.data() as CallCenterMember);
      });
      setTeamMembers(members);
    });

    return () => unsub();
  }, [restaurant.id]);

  // 3. Sync Menu Items if Shift Manager accesses it
  useEffect(() => {
    if (member.role !== "shift_manager" || activeTab !== "menu") return;

    const menuQuery = query(
      collection(db, "restaurants", restaurant.id, "menu_items")
    );

    const unsub = onSnapshot(menuQuery, (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data() as MenuItem, id: doc.id });
      });
      setMenuItems(items);
    });

    return () => unsub();
  }, [restaurant.id, member.role, activeTab]);

  // 4. Sync specific order chat conversations
  useEffect(() => {
    if (!activeChatOrderId) return;

    const messagesQuery = query(
      collection(db, "orders", activeChatOrderId, "messages")
    );

    const unsub = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        messagesList.push({ ...doc.data() as ChatMessage, id: doc.id });
      });
      messagesList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setChatMessages(messagesList);

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsub();
  }, [activeChatOrderId]);

  // Handle Order Status Operations
  const updateOrderStatus = async (orderId: string, newStatus: Order["status"], extraProps: any = {}) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const updateObj: any = { status: newStatus, ...extraProps };
      
      // If accepting an order
      if (newStatus === "preparing" && !extraProps.acceptedBy) {
        updateObj.acceptedBy = {
          name: member.name,
          email: member.email,
          role: member.role,
          acceptedAt: new Date().toISOString()
        };
      }
      
      await updateDoc(orderRef, updateObj);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Submit cancel order
  const handleCancelOrderSubmit = async () => {
    if (!cancellationOrderId || !cancellationReason.trim()) return;
    await updateOrderStatus(cancellationOrderId, "cancelled", {
      cancelReason: cancellationReason.trim(),
      cancelledBy: "owner" // Treated as service team cancellation
    });
    setCancellationOrderId(null);
    setCancellationReason("");
  };

  // Assign order to agent (Team Leader/Manager function)
  const handleAssignAgent = async (orderId: string) => {
    const selectedAgentEmail = agentAssignTarget[orderId];
    if (!selectedAgentEmail) return;

    const agent = teamMembers.find(t => t.email === selectedAgentEmail);
    if (!agent) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        assignedTo: {
          name: agent.name,
          email: agent.email,
          assignedAt: new Date().toISOString()
        }
      });
      alert(`تم إسناد الطلب إلى الموظف: ${agent.name}`);
    } catch (err) {
      console.error("Error assigning agent:", err);
    }
  };

  // Toggle MenuItem Availability (Shift Manager function)
  const toggleItemAvailability = async (itemId: string, currentAvailable: boolean) => {
    try {
      const itemRef = doc(db, "restaurants", restaurant.id, "menu_items", itemId);
      await updateDoc(itemRef, { isAvailable: !currentAvailable });
    } catch (err) {
      console.error("Error toggling item availability:", err);
    }
  };

  // Chat message send
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatOrderId || !newChatMessage.trim()) return;

    try {
      const msgData: Omit<ChatMessage, "id"> = {
        sender: "agent",
        senderName: `${member.name} (${member.role === 'agent' ? 'كول سنتر' : member.role === 'team_leader' ? 'مشرف' : 'مدير'})`,
        text: newChatMessage.trim(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "orders", activeChatOrderId, "messages"), msgData);
      setNewChatMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Add/Edit Team Member submission (Shift Manager function)
  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, role } = memberForm;

    if (!name.trim() || !email.trim() || !password.trim()) {
      alert("الرجاء ملء كافة بيانات الموظف بشكل صحيح!");
      return;
    }

    try {
      const targetEmail = email.trim().toLowerCase();
      const memberDocRef = doc(db, "call_center_members", targetEmail);
      
      const payload: CallCenterMember = {
        name: name.trim(),
        email: targetEmail,
        password: password.trim(),
        role,
        restaurantId: restaurant.id,
        createdAt: new Date().toISOString()
      };

      await setDoc(memberDocRef, payload);
      setShowMemberModal(false);
      setEditingMemberEmail(null);
      setMemberForm({ name: "", email: "", password: "", role: "agent" });
      alert("تم حفظ بيانات موظف الكول سنتر بنجاح!");
    } catch (err) {
      console.error("Error saving team member:", err);
      alert("فشل حفظ بيانات الموظف بسبب القيود الأمنية.");
    }
  };

  // Delete team member
  const handleDeleteMember = async (email: string) => {
    if (email === member.email) {
      alert("لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول!");
      return;
    }
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الموظف من الكول سنتر نهائياً؟")) return;

    try {
      await deleteDoc(doc(db, "call_center_members", email.toLowerCase()));
      alert("تم حذف الموظف بنجاح.");
    } catch (err) {
      console.error("Error deleting member:", err);
    }
  };

  // Filtered orders list mapping
  const filteredOrders = orders.filter(o => {
    // 1. Filter by status selection
    if (orderFilter !== "all" && o.status !== orderFilter) return false;

    // 2. Filter by Agent role limits:
    // "احمد اللي هو ايجنت له دور محدد وهو التعامل مع اوردراته والاوردرات الجديدة"
    if (member.role === "agent") {
      // Show if it is a new pending order
      if (o.status === "pending") return true;
      // Show if directly accepted by this agent
      if (o.acceptedBy?.email === member.email) return true;
      // Show if explicitly assigned to this agent by a leader/manager
      if (o.assignedTo?.email === member.email) return true;
      
      return false;
    }

    return true;
  });

  // Calculate quick stats of processed orders for each staff
  const getAgentStatsMap = () => {
    const stats: { [email: string]: { name: string; acceptedCount: number; readyCount: number; completedCount: number } } = {};
    
    // Seed current team
    teamMembers.forEach(t => {
      stats[t.email] = { name: t.name, acceptedCount: 0, readyCount: 0, completedCount: 0 };
    });

    orders.forEach(o => {
      if (o.acceptedBy?.email && stats[o.acceptedBy.email]) {
        if (o.status === "preparing") stats[o.acceptedBy.email].acceptedCount++;
        if (o.status === "ready") stats[o.acceptedBy.email].readyCount++;
        if (o.status === "completed") stats[o.acceptedBy.email].completedCount++;
      }
    });

    return stats;
  };

  const agentStats = getAgentStatsMap();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col" dir="rtl">
      {/* Upper header segment and user identity */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo brand and identity */}
          <div className="flex items-center gap-3">
            <div className="bg-orange-600/20 p-2.5 rounded-2xl border border-orange-500/30">
              <ChefHat className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <span className="text-[10px] text-orange-400 font-bold tracking-widest block uppercase">مركز الاتصال والكول سنتر 📞</span>
              <h1 className="text-sm sm:text-base font-black text-white">{restaurant?.name}</h1>
            </div>
          </div>

          {/* Active Member Bio and Roles badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            
            {/* Audio Buzzer Control badge */}
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${
                isMuted 
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700" 
                  : "bg-orange-950/40 hover:bg-orange-950 text-orange-400 border-orange-500/30"
              }`}
            >
              <span>{isMuted ? "🔇 رنين معطل" : "🔔 رنين متكرر نشط"}</span>
            </button>

            <div className="bg-slate-800/80 border border-slate-700/60 p-1.5 rounded-xl flex items-center gap-2">
              <div className="bg-slate-700 text-slate-200 text-xs w-7 h-7 flex items-center justify-center rounded-lg font-black">
                {member.name.charAt(0)}
              </div>
              <div className="text-right pl-2">
                <span className="text-[10px] font-black block text-slate-100">{member.name}</span>
                <span className="text-[8px] bg-slate-900 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                  {member.role === "agent" && "🎧 عميل كول سنتر"}
                  {member.role === "team_leader" && "👑 رئيس مجموعة - تيم ليدر"}
                  {member.role === "shift_manager" && "💼 مسؤول وردية - كل الأدوار"}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="bg-red-950/20 hover:bg-red-900 text-red-400 p-2.5 rounded-xl border border-red-500/20 transition hover:scale-105 active:scale-95"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Responsive Dashboard sidebar tabs */}
        <aside className="md:w-60 shrink-0 space-y-1.5">
          <div className="text-slate-500 text-[10px] font-bold tracking-wider uppercase px-2.5 mb-1.5">أدوات التحكم والعمل</div>
          
          <button
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-xs ${
              activeTab === "orders" 
                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              <span>أوردرات المطبخ</span>
            </div>
            {orders.filter(o => o.status === "pending").length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {orders.filter(o => o.status === "pending").length}
              </span>
            )}
          </button>

          {(member.role === "team_leader" || member.role === "shift_manager") && (
            <button
              onClick={() => setActiveTab("team")}
              className={`w-full flex items-center gap-2 px-3.5 py-3 rounded-xl transition-all font-bold text-xs ${
                activeTab === "team" 
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة فريق العمل</span>
            </button>
          )}

          {member.role === "shift_manager" && (
            <>
              <button
                onClick={() => setActiveTab("menu")}
                className={`w-full flex items-center gap-2 px-3.5 py-3 rounded-xl transition-all font-bold text-xs ${
                  activeTab === "menu" 
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>إتاحة ونقص الأطباق 🥘</span>
              </button>

              <button
                onClick={() => setActiveTab("hours")}
                className={`w-full flex items-center gap-2 px-3.5 py-3 rounded-xl transition-all font-bold text-xs ${
                  activeTab === "hours" 
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>⏱️ أوقات تشغيل المطعم</span>
              </button>
            </>
          )}

          {/* Quick Notice Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 mt-6 text-xs text-slate-400 leading-relaxed text-right space-y-2">
            <span className="font-extrabold text-orange-400 block text-[10px]">ملاحظة هامة للموظف 💡</span>
            <p>
              يجب متابعة نغمة الرنين، في حال وجود أوردر باللون البرتقالي الوامض هذا يعني أنه معلق وبحاجة للقبول الفوري.
            </p>
          </div>
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
          
          {/* TAB 1: ORDERS SECTION MATCHING STAFF CAPABILITIES */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-black text-white">إدارة ومتابعة طلبات الزبائن 📋</h2>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {member.role === "agent" 
                      ? "تظهر لك الطلبات معلقة القبول بالإضافة لأوردراتك المخصصة فقط"
                      : "تظهر لك كافة طلبات المطعم مع صلاحيات التعيين لموظفي الكول سنتر"}
                  </p>
                </div>

                {/* Horizontal status switch filter tags */}
                <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  {[
                    { val: "all", label: "الكل" },
                    { val: "pending", label: "برتقالي ⏱️ معلق" },
                    { val: "preparing", label: "قيد التجهيز" },
                    { val: "ready", label: "جاهز للتسليم" },
                    { val: "completed", label: "مكتمل" },
                    { val: "cancelled", label: "ملغي" }
                  ].map(tab => (
                    <button
                      key={tab.val}
                      onClick={() => setOrderFilter(tab.val as any)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition duration-150 ${
                        orderFilter === tab.val
                          ? "bg-orange-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* No Orders State */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="bg-slate-900/60 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-slate-500">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-slate-300">لا يوجد أوردرات نشطة حالياً</h3>
                  <p className="text-[10px] text-slate-500">عند القيام بأي طلب جديد، ستبدأ نغمة الرنين بالعمل تلقائياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredOrders.map(order => {
                    const isPending = order.status === "pending";
                    const isPreparing = order.status === "preparing";
                    const isReady = order.status === "ready";
                    const isCompleted = order.status === "completed";
                    const isCancelled = order.status === "cancelled";

                    return (
                      <div 
                        key={order.id}
                        className={`bg-slate-900/50 border rounded-2xl p-4 flex flex-col justify-between transition-all relative ${
                          isPending 
                            ? "border-orange-500 shadow-lg shadow-orange-500/5 ring-1 ring-orange-500 animate-pulse-slow bg-orange-600/5" 
                            : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          {/* Order Identifier Header info */}
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-500 font-mono block">الرقم التعريفي للطلب: {order.id.slice(0, 8)}...</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{new Date(order.createdAt).toLocaleTimeString("ar-EG")} - {new Date(order.createdAt).toLocaleDateString("ar-EG")}</span>
                            </div>
                            
                            {/* Order Action Buttons and status indicators */}
                            <div>
                              {isPending && <span className="bg-orange-500/20 text-orange-400 text-[9px] font-black px-2 py-1 rounded-lg border border-orange-500/30">برتقالي معلق ⏱️</span>}
                              {isPreparing && <span className="bg-yellow-500/20 text-yellow-500 text-[9px] font-black px-2 py-1 rounded-lg border border-yellow-500/30">قيد التجهيز 👨‍🍳</span>}
                              {isReady && <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black px-2 py-1 rounded-lg border border-blue-500/30">جاهز للتوصيل 🛵</span>}
                              {isCompleted && <span className="bg-green-600/20 text-green-400 text-[9px] font-black px-2 py-1 rounded-lg border border-green-500/30">مكتمل ومستلم ✅</span>}
                              {isCancelled && <span className="bg-red-500/20 text-red-400 text-[9px] font-black px-2 py-1 rounded-lg border border-red-500/30">ملغي ❌</span>}
                            </div>
                          </div>

                          {/* Customer Data Elements */}
                          <div className="space-y-1.5 text-xs text-slate-300">
                            <div className="flex justify-between">
                              <span className="text-slate-500 text-[10px]">العميل:</span>
                              <span className="font-extrabold text-white">{order.customerName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 text-[10px]">الهاتف:</span>
                              <span className="font-mono text-slate-200 underline">{order.customerPhone}</span>
                            </div>
                            <div className="flex justify-between pb-1">
                              <span className="text-slate-500 text-[10px]">العنوان واللوكيشن:</span>
                              <span className="text-slate-200 text-left truncate max-w-xs">{order.deliveryAddress || "طلب صالة / استلام فرع"}</span>
                            </div>

                            {/* Additional Address parts */}
                            {(order.customerGovernorate || order.customerStreet) && (
                              <div className="bg-slate-950 p-2 rounded-xl text-[10px] text-slate-400 flex flex-wrap gap-1">
                                {order.customerGovernorate && <span>محافظة: {order.customerGovernorate}</span>}
                                {order.customerStreet && <span> | شارع: {order.customerStreet}</span>}
                              </div>
                            )}

                            {/* Order Source details */}
                            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40 mt-2 space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">نوع الطلب / التوصيل:</span>
                                <span className="text-orange-400 font-extrabold">
                                  {order.orderType === "delivery" && "🛵 ديلفري للمنزل"}
                                  {order.orderType === "dine_in" && `🍽️ صالة مطعم (طاولة ${order.tableNumber})`}
                                  {order.orderType === "pickup" && "🛍️ استلام تيك أواي من الفرع"}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500">طريقة السداد والتشغيل:</span>
                                <span className="text-slate-300 font-bold">
                                  {order.paymentMethod === "cash" && "💵 كاش نقدي"}
                                  {order.paymentMethod === "visa" && "💳 فيزا الدفع ببطاقة"}
                                  {order.paymentMethod === "instapay" && "📲 إنستاباي للدفع السريع"}
                                  {order.paymentMethod === "vodafone_cash" && "🦊 فودافون كاش ومراجعة السكرين"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Order Items with counts */}
                          <div className="mt-3.5 space-y-1 border-t border-slate-800/60 pt-3">
                            <span className="text-slate-500 text-[10px] block mb-1">الوجبات المطلوبة:</span>
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-[10.5px] bg-slate-950/40 px-2 py-1.5 rounded-lg border border-slate-800/20">
                                <span className="text-slate-400">{(it.price * it.quantity).toFixed(0)} ج.م</span>
                                <span className="font-extrabold text-white">{it.name} <span className="text-orange-500 text-xs font-black">× {it.quantity}</span></span>
                              </div>
                            ))}
                            {order.loyaltyDiscountApplied ? (
                              <div className="flex justify-between text-[10px] text-red-400 px-1">
                                <span>-{order.loyaltyDiscountApplied.toFixed(0)} ج.م</span>
                                <span>خصم نقاط الولاء:</span>
                              </div>
                            ) : null}
                            {order.couponDiscountApplied ? (
                              <div className="flex justify-between text-[10px] text-red-400 px-1">
                                <span>-{order.couponDiscountApplied.toFixed(0)} ج.م</span>
                                <span>خصم كود ({order.couponCode}):</span>
                              </div>
                            ) : null}
                            <div className="flex justify-between items-center bg-orange-600/20 text-orange-400 px-3 py-2 rounded-xl mt-2 border border-orange-500/20">
                              <span className="font-black text-sm">{order.totalPrice.toFixed(2)} ج.م</span>
                              <span className="text-[11px] font-extrabold">إجمالي الفاتورة:</span>
                            </div>
                          </div>

                          {/* Who accepted (أحمد المنسي مثلاً) أو مخصص لـ */}
                          <div className="mt-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/50 space-y-1 text-[10.2px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">حالة التجهيز:</span>
                              <span className="text-slate-200">
                                {order.acceptedBy ? (
                                  <span className="text-green-400 font-extrabold">
                                    قبله وسجله: {order.acceptedBy.name} ({order.acceptedBy.role === 'agent' ? 'كول سنتر' : 'مدير'})
                                  </span>
                                ) : (
                                  <span className="text-amber-500 italic">انتظار القبول...</span>
                                )}
                              </span>
                            </div>
                            {order.assignedTo && (
                              <div className="flex justify-between pt-0.5 border-t border-slate-900 mt-1">
                                <span className="text-slate-500">تعيين وإسناد بواسطة المشرف:</span>
                                <span className="text-blue-400 font-extrabold">مخصص للعميل: {order.assignedTo.name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order Management Actions row */}
                        <div className="mt-4 gap-2 flex flex-col border-t border-slate-800/60 pt-3">
                          
                          {/* Live Chat triggers */}
                          <button
                            type="button"
                            onClick={() => setActiveChatOrderId(order.id)}
                            className="w-full py-2.5 bg-blue-950/40 hover:bg-blue-900/60 text-blue-400 rounded-xl text-[10.5px] font-black border border-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>شات المحادثة المباشرة مع العميل 💬</span>
                          </button>

                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {/* Accept flow */}
                            {isPending && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "preparing")}
                                className="col-span-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md transition transform active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                <span>قبول وتثبيت الطلب للطهيز 👨‍🍳</span>
                              </button>
                            )}

                            {isPreparing && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "ready")}
                                className="col-span-2 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-slate-950 rounded-xl text-xs font-black shadow-md transition transform active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1"
                              >
                                <ChefHat className="w-4 h-4 text-slate-950" />
                                <span>الطلب جاهز للتسليم 🛵</span>
                              </button>
                            )}

                            {isReady && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "completed")}
                                className="col-span-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black shadow-md transition transform active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                <span>إتمام الطلب وتسليمه للعميل ✅</span>
                              </button>
                            )}

                            {/* Cancel triggers */}
                            {!isCompleted && !isCancelled && (
                              <button
                                onClick={() => {
                                  setCancellationOrderId(order.id);
                                  setCancellationReason("");
                                }}
                                className="py-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-xl text-[10px] font-black border border-red-500/20 transition cursor-pointer text-center"
                              >
                                إلغاء وإغلاق ❌
                              </button>
                            )}

                            {/* Assign agent box (Leaders & Managers only) */}
                            {(member.role === "team_leader" || member.role === "shift_manager") && !isCompleted && !isCancelled && (
                              <div className="flex gap-1">
                                <select
                                  value={agentAssignTarget[order.id] || ""}
                                  onChange={(e) => setAgentAssignTarget(prev => ({ ...prev, [order.id]: e.target.value }))}
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-[9.5px] text-slate-300 focus:outline-none focus:border-orange-500 font-extrabold"
                                >
                                  <option value="">اختر عميل كول سنتر</option>
                                  {teamMembers.filter(t => t.role === "agent").map(team => (
                                    <option key={team.email} value={team.email}>{team.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignAgent(order.id)}
                                  disabled={!agentAssignTarget[order.id]}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black transition disabled:opacity-40"
                                >
                                  إسناد
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEAM MEMBERS SECTION */}
          {activeTab === "team" && (member.role === "team_leader" || member.role === "shift_manager") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-black text-white">إدارة فريق الكول سنتر 🎧</h2>
                  <p className="text-[10px] text-slate-400 mt-1">يمكن لمسؤول الوردية إضافة وإزالة الموظفين وتغيير كلمات المرور والوظائف المحددة.</p>
                </div>
                {member.role === "shift_manager" && (
                  <button
                    onClick={() => {
                      setEditingMemberEmail(null);
                      setMemberForm({ name: "", email: "", password: "", role: "agent" });
                      setShowMemberModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-xl text-xs font-black shadow-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة موظف كول سنتر 🎧</span>
                  </button>
                )}
              </div>

              {/* Members lists table */}
              <div className="overflow-x-auto bg-slate-900/30 border border-slate-800 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-black">
                      <th className="p-3">اسم الموظف</th>
                      <th className="p-3">الإيميل الخاص به</th>
                      <th className="p-3">كلمة المرور</th>
                      <th className="p-3">الدور الوظيفي</th>
                      <th className="p-3">إحصاء تشغيل الأوردرات</th>
                      {member.role === "shift_manager" && <th className="p-3 text-center">الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((m, idx) => {
                      const userStats = agentStats[m.email] || { acceptedCount: 0, readyCount: 0, completedCount: 0 };
                      return (
                        <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-900/20 text-slate-300">
                          <td className="p-3 font-extrabold text-white">{m.name}</td>
                          <td className="p-3 font-mono text-slate-400">{m.email}</td>
                          <td className="p-3 font-mono text-slate-400">{m.password || "••••••••"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black font-sans ${
                              m.role === "shift_manager" 
                                ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                : m.role === "team_leader" 
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-green-500/10 text-green-400 border border-green-500/20"
                            }`}>
                              {m.role === "shift_manager" && "💼 مسؤول الوردية"}
                              {m.role === "team_leader" && "👑 تيم ليدر"}
                              {m.role === "agent" && "🎧 ايجنت كول سنتر"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-slate-400">قيد التحضير: <strong className="text-yellow-500">{userStats.acceptedCount}</strong> | مكتمل ومستلم: <strong className="text-green-400">{userStats.completedCount}</strong></span>
                          </td>
                          {member.role === "shift_manager" && (
                            <td className="p-3 text-center space-x-1.5">
                              <button
                                onClick={() => {
                                  setEditingMemberEmail(m.email);
                                  setMemberForm({
                                    name: m.name,
                                    email: m.email,
                                    password: m.password || "",
                                    role: m.role
                                  });
                                  setShowMemberModal(true);
                                }}
                                className="text-blue-400 hover:text-blue-300 transition"
                                title="تعديل الموظف"
                              >
                                <Edit2 className="w-3.5 h-3.5 inline" />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m.email)}
                                className="text-red-400 hover:text-red-300 transition"
                                title="حذف الموظف"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MENU AVAILABILITY - SHIFT MANAGERS ONLY */}
          {activeTab === "menu" && member.role === "shift_manager" && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-base font-black text-white font-sans">وجبات وأطباق المنيو 🥘</h2>
                <p className="text-[10px] text-slate-400 mt-1">تعديل فوري لإتاحة أو حجب الوجبات في حالة نفاذ الكميات من المطبخ لمنع استقبال طلباتها.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between hover:border-slate-700 transition">
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-800" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="bg-slate-950 w-12 h-12 rounded-xl flex items-center justify-center border border-slate-800 text-slate-600 font-bold">🍔</div>
                      )}
                      <div>
                        <span className="bg-slate-950 text-slate-500 font-bold px-1.5 py-0.5 rounded-md text-[8px] tracking-wide inline-block">{item.category}</span>
                        <h4 className="text-xs font-black text-white mt-1">{item.name}</h4>
                        <span className="text-[10.5px] text-orange-400 font-extrabold block mt-0.5">{item.price} ج.م</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleItemAvailability(item.id, item.isAvailable)}
                      className="cursor-pointer transition transform active:scale-95 text-slate-400"
                    >
                      {item.isAvailable ? (
                        <div className="flex items-center gap-1 text-green-400 font-extrabold text-[10px]">
                          <span>متاح حالياً</span>
                          <ToggleRight className="w-10 h-10 text-green-500" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-400 font-extrabold text-[10px]">
                          <span>غير متوفر ⚠️</span>
                          <ToggleLeft className="w-10 h-10 text-slate-700" />
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: WORKING HOURS - SHIFT MANAGERS ONLY */}
          {activeTab === "hours" && member.role === "shift_manager" && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-base font-black text-white">إغلاق وفتح المطعم مؤقتاً ⏱️</h2>
                <p className="text-[10px] text-slate-400 mt-1">تعديل ساعات العمل وتجميد أو استئناف استقبال الطلبات من العملاء.</p>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-white">حالة استقبال الطلبات العامة للمطعم</h3>
                    <p className="text-[10px] text-slate-500 mt-1">يمكنك إيقاف استقبال الأوردرات مؤقتاً في حالات الازدحام أو الشغل الطارئ.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const newStatus = restaurant.status === "trial" ? "active" : restaurant.status === "active" ? "expired" : "active";
                      try {
                        const restaurantRef = doc(db, "restaurants", restaurant.id);
                        await updateDoc(restaurantRef, { status: newStatus as any });
                        alert("تم تحديث حالة تفعيل المطعم بنجاح!");
                      } catch (e) {
                        alert("فشل تحديث حالة المطعم.");
                      }
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold font-sans transition ${
                      restaurant.status === "active" || restaurant.status === "trial"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    {restaurant.status === "active" || restaurant.status === "trial" ? "🟢 استقبال الطلبات مفعل ومتاح" : "🔴 استقبال الطلبات معطل ومغلق"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"].map((dayKey) => {
                    const daysMap: Record<string, string> = {
                      saturday: "السبت", sunday: "الأحد", monday: "الإثنين",
                      tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة"
                    };

                    const sched = restaurant.workingHours?.[dayKey] || { isOpen: true, openTime: "09:00", closeTime: "23:00" };

                    return (
                      <div key={dayKey} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-200 block text-xs">{daysMap[dayKey]}</strong>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">من {sched.openTime} إلى {sched.closeTime}</span>
                        </div>

                        <button
                          onClick={async () => {
                            if (!window.confirm(`هل تريد تغيير حالة عمل المطعم في يوم (${daysMap[dayKey]})؟`)) return;
                            try {
                              const updatedHours = {
                                ...restaurant.workingHours,
                                [dayKey]: {
                                  ...sched,
                                  isOpen: !sched.isOpen
                                }
                              };
                              const restaurantRef = doc(db, "restaurants", restaurant.id);
                              await updateDoc(restaurantRef, { workingHours: updatedHours });
                            } catch (e) {
                              console.error("Failed to update hours", e);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9.5px] font-black transition ${
                            sched.isOpen ? "bg-green-950/40 text-green-400 border border-green-500/20" : "bg-red-950/45 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {sched.isOpen ? "مفتوح في هذا اليوم" : "مغلق طوال اليوم"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* FLOATING ACTION OVERLAY 1: REAL-TIME CHAT PANEL WITH INDIVIDUAL CUSTOMER */}
      <AnimatePresence>
        {activeChatOrderId && (
          <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg h-[500px] flex flex-col overflow-hidden text-right shadow-2xl"
            >
              {/* Chat head */}
              <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setActiveChatOrderId(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 p-2 rounded-xl transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono block">رقم الأوردر: #{activeChatOrderId.slice(0, 8)}</span>
                    <h4 className="text-xs font-black text-white">الدردشة المباشرة مع العميل 💬</h4>
                  </div>
                  <div className="bg-orange-600/10 p-2 rounded-xl border border-orange-500/20">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                  </div>
                </div>
              </div>

              {/* Chat room list messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-20 space-y-1.5 text-slate-500 text-xs">
                    <p>لا يوجد رسائل مرسلة بعد.</p>
                    <p className="text-[10px] text-slate-650">بادر بالترحيب بالعميل والرد على استفساره فوراً!</p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.sender === "agent";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed border ${
                          isMe 
                            ? "bg-slate-800/80 text-white border-slate-700/80 rounded-tl-none" 
                            : "bg-orange-600 text-white border-orange-500 rounded-tr-none text-right"
                        }`}>
                          <span className="text-[8px] text-slate-400 font-bold block mb-1">{msg.senderName}</span>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <span className="text-[7.5px] text-slate-400/85 font-mono block text-left mt-1.5">
                            {new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat action message send */}
              <form onSubmit={handleSendChatMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                <button
                  type="submit"
                  disabled={!newChatMessage.trim()}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-extrabold px-4 rounded-xl text-xs transition duration-150 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  placeholder="اكتب رسالتك للمساعدة وتتبع الأوردر..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 text-right focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-semibold"
                />
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ORDER CANCELLATION REQUEST INPUT FORM */}
      {cancellationOrderId && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm space-y-4 text-right">
            <h3 className="text-sm font-black text-white flex items-center justify-end gap-1.5">
              <span>سبب إلغاء وإغلاق هذا الطلب ⚠️</span>
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">يرجى كتابة سبب الإلغاء بوضوح ليظهر للعميل في شاشته ولتوضيح الموقف لمالك المطعم والشيفت.</p>
            
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="مثال: نفاذ وجبة الشاورما من المطبخ حالياً، أو تكرار بالخطأ من العميل"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500 min-h-24 resize-none"
              maxLength={250}
            />

            <div className="flex gap-2">
              <button
                onClick={handleCancelOrderSubmit}
                disabled={!cancellationReason.trim()}
                className="flex-1 bg-red-650 hover:bg-red-700 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer text-center"
              >
                تأكيد الإلغاء والغلق
              </button>
              <button
                onClick={() => setCancellationOrderId(null)}
                className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 py-2 rounded-xl text-xs font-bold transition cursor-pointer text-center"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: STAFF CREATE/EDIT POPUP DIALOG */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveTeamMember} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl w-full max-w-sm space-y-4 text-right">
            <h3 className="text-sm font-black text-white">
              {editingMemberEmail ? "تعديل موظف الكول سنتر الحالي 📝" : "إنشاء موظف كول سنتر جديد 🎧"}
            </h3>
            
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-extrabold">الاسم الكامل للموظف:</label>
                <input
                  type="text"
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: أحمد المنسي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-extrabold">عنوان الإيميل (Email) الخاص به:</label>
                <input
                  type="email"
                  required
                  disabled={!!editingMemberEmail}
                  value={memberForm.email}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="ahmed@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-extrabold">كلمة المرور للدخول للشيفت (Password):</label>
                <input
                  type="text"
                  required
                  value={memberForm.password}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="أدخل كلمة مرور قوية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-extrabold">الدور والصلاحية في مركز الاتصال:</label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm(prev => ({ ...prev, role: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-bold"
                >
                  <option value="agent">🎧 عميل كول سنتر (ايجنت)</option>
                  <option value="team_leader">👑 رئيس المجموعة (تيم ليدر)</option>
                  <option value="shift_manager">💼 مسؤول الوردية (معظم الأدوار)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl text-xs transition"
              >
                تأكيد وحفظ البيانات
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMemberModal(false);
                  setEditingMemberEmail(null);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs transition font-black"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
