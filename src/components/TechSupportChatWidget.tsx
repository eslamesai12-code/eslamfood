import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, doc } from "firebase/firestore";
import { MessageSquare, X, Send, Paperclip, CheckCheck, Landmark, HelpCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { compressImage, isSizeSafe } from "../lib/imageCompressor";

interface TechSupportChatWidgetProps {
  userId: string;
  userName: string;
  userType: 'customer' | 'owner' | 'admin';
  restaurantId?: string;
  restaurantName?: string;
}

interface SupportMessage {
  id: string;
  chatId: string;
  text: string;
  mediaUrl?: string;
  senderId: string;
  senderName: string;
  userType: 'customer' | 'owner' | 'admin';
  createdAt: string;
}

export default function TechSupportChatWidget({ 
  userId, 
  userName, 
  userType,
  restaurantId = "general",
  restaurantName = "عام" 
}: TechSupportChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  // Load global settings for fonts and colors
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "admin_settings", "global"), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    });
    return () => unsub();
  }, []);

  // Generate a distinct chatId for technical support
  const chatSessionId = userType === "owner" 
    ? `owner-support-${restaurantId}`
    : `customer-support-${restaurantId}-${userId.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Read message logs
  useEffect(() => {
    if (!isOpen) {
      // Listen to last message to mark unread if chat is closed
      const q = query(
        collection(db, "support_chats"),
        where("chatId", "==", chatSessionId),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const unsubUnread = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const lastMsg = snapshot.docs[0].data() as SupportMessage;
          if (lastMsg.senderId !== userId) {
            setUnreadCount(prev => prev + 1);
          }
        }
      });
      return () => unsubUnread();
    } else {
      setUnreadCount(0);
    }
  }, [isOpen, chatSessionId, userId]);

  // Real-time messages sync
  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, "support_chats"),
      where("chatId", "==", chatSessionId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: SupportMessage[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SupportMessage);
      });
      setMessages(list);
    }, (err) => {
      console.error("Error loading tech support messages:", err);
    });

    return () => unsub();
  }, [isOpen, chatSessionId]);

  // Scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;

    if (mediaUrl && !isSizeSafe(mediaUrl)) {
      alert("عذراً، حجم الصورة كبير جداً لضمان الأمان وسرعة الإرسال.");
      return;
    }

    const messageText = newMessage;
    const attachedMedia = mediaUrl;
    setNewMessage("");
    setMediaUrl(null);

    try {
      await addDoc(collection(db, "support_chats"), {
        chatId: chatSessionId,
        text: messageText,
        mediaUrl: attachedMedia || "",
        senderId: userId,
        senderName: userName,
        userType: userType,
        createdAt: new Date().toISOString(),
        restaurantId,
        restaurantName
      });
    } catch (err) {
      console.error("Error creating support chat document:", err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.75);
      if (!isSizeSafe(compressedBase64)) {
        alert("عذراً، حجم هذه الصورة كبير جداً للاستخدام الفني. يرجى اختيار لقطة أصغر.");
        return;
      }
      setMediaUrl(compressedBase64);
    } catch (err) {
      console.error("Failed to compress support comment image:", err);
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isSizeSafe(result)) {
          setMediaUrl(result);
        } else {
          alert("حجم الصورة كبير جداً، يرجى مراجعة الجودة.");
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed bottom-[141px] left-6 z-50 font-sans" dir="rtl">
      {/* Floating Button */}
      <div className="relative">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-[#fa5a00] hover:from-orange-600 hover:to-[#fa5a00] text-white rounded-full p-4 shadow-xl shadow-orange-500/25 border border-orange-400/30 cursor-pointer transition focus:ring-2 focus:ring-[#fa5a00] focus:outline-none"
        >
          <MessageSquare className="w-5 h-5 text-white animate-pulse" />
          <span className="text-xs font-black hidden md:inline pr-1">الدعم الفني المباشر 🛡️</span>
        </motion.button>

        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="absolute bottom-16 left-0 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            style={{ fontFamily: globalSettings?.platformFontFamily || "inherit" }}
          >
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <h3 className="font-black text-xs text-white">محادثة الدعم الفني للمنصة 👨‍💻</h3>
                  <p className="text-[9px] text-orange-400 font-extrabold">نحن متصلون لمساعدتك فوراً</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Support Welcome Context Info */}
            <div className="bg-orange-50 border-b border-orange-100/60 p-3.5 text-right">
              <p className="text-[11px] text-orange-950 leading-relaxed font-black">
                أهلاً بك يا <span className="text-[#fa5a00] font-black">{userName}</span> (بصفتك {userType === "owner" ? "مالك مطعم" : "عميل"}). اكتب استفسارك أو مشكلتك الفنية لنقوم بحلها وإرشادك فوراً!
              </p>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="text-center py-24 space-y-3">
                  <div className="w-12 h-12 bg-orange-100 text-orange-650 rounded-full flex items-center justify-center mx-auto text-lg animate-bounce">
                    🛡️
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800">لا توجد رسائل سابقة</p>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium px-4">ابدأ بطرح أسئلتك بخصوص الدفع المالي، إعدادات المطبخ، أو توجيهات الدليفري وسيتواصل معك مهندسو المنصة.</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === userId;
                  return (
                    <div 
                      key={msg.id}
                      className={`flex flex-col ${isMine ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] text-slate-500 font-black">
                          {isMine ? `${msg.senderName} (أنا) 👤` : msg.senderName} ({msg.userType === "admin" ? "ممثّل المنصة" : msg.userType === "owner" ? "مالك" : "عميل"})
                        </span>
                      </div>
                      <div 
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11.5px] sm:text-[12.5px] font-black leading-relaxed shadow-xs ${
                          isMine 
                            ? "rounded-tr-none" 
                            : "bg-white text-slate-950 border border-slate-200 rounded-tl-none"
                        }`}
                        style={isMine ? {
                          backgroundColor: globalSettings?.chatBubbleColor || "#fa5a00",
                          color: globalSettings?.chatTextColor || "#ffffff",
                          fontSize: globalSettings?.platformFontSize || "inherit"
                        } : { fontSize: globalSettings?.platformFontSize || "inherit" }}
                      >
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                        {msg.mediaUrl && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                            <img 
                              src={msg.mediaUrl} 
                              alt="Attached" 
                              className="max-w-full h-auto max-h-40 object-contain mx-auto" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-slate-400 mt-0.5 select-none pr-1">
                        {new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Upload preview */}
            {mediaUrl && (
              <div className="bg-slate-100 p-2 border-t flex items-center justify-between animate-slide-up">
                <div className="flex items-center gap-2">
                  <img src={mediaUrl} alt="Preview" className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                  <span className="text-[10px] text-slate-500 font-bold">صورة مرفقة جاهزة للإرسال</span>
                </div>
                <button 
                  onClick={() => setMediaUrl(null)}
                  className="bg-red-50 text-red-650 hover:bg-red-100 p-1 rounded-full text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Input form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t bg-white flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب رسالتك للمهندسين هنا..."
                className="flex-grow text-xs border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#fa5a00] focus:ring-1 focus:ring-[#fa5a00] font-bold text-slate-900 placeholder-slate-400"
              />

              <label className="text-slate-500 hover:text-[#fa5a00] p-2 border border-slate-200 rounded-xl hover:bg-orange-50 cursor-pointer shrink-0 transition">
                <Paperclip className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload} 
                  disabled={uploadingImage}
                />
              </label>

              <button
                type="submit"
                disabled={uploadingImage || (!newMessage.trim() && !mediaUrl)}
                className="bg-[#fa5a00] hover:bg-orange-600 disabled:bg-slate-200 text-white p-2.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4 flip-horizontal" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
