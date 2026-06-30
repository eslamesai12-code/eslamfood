import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { Send, Image, MessageSquare, AlertCircle, ShoppingBag, Clock, CheckCheck, Loader2 } from "lucide-react";
import { compressImage, isSizeSafe } from "../lib/imageCompressor";

interface OrderChatComponentProps {
  orderId: string;
  userId: string; // Phone/email for customer, restaurantId/ownerId for owner
  userName: string;
  userType: 'customer' | 'owner';
}

interface OrderMessage {
  id: string;
  orderId: string;
  text: string;
  mediaUrl?: string;
  senderId: string;
  senderName: string;
  userType: 'customer' | 'owner';
  createdAt: string;
}

export default function OrderChatComponent({ orderId, userId, userName, userType }: OrderChatComponentProps) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newText, setNewText] = useState("");
  const [base64Media, setBase64Media] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync messages
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "order_chats"),
      where("orderId", "==", orderId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: OrderMessage[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as OrderMessage);
      });
      setMessages(list);
      setLoading(false);
    }, (err) => {
      console.error("Error reading order messages:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  // Scroll bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() && !base64Media) return;

    if (base64Media && !isSizeSafe(base64Media)) {
      alert("عذراً، حجم الصورة كبير جداً لضمان الأمان وسرعة الإرسال.");
      return;
    }

    const currentText = newText;
    const currentMedia = base64Media;
    setNewText("");
    setBase64Media(null);

    try {
      await addDoc(collection(db, "order_chats"), {
        orderId,
        text: currentText,
        mediaUrl: currentMedia || "",
        senderId: userId,
        senderName: userName,
        userType,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to insert order message:", err);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingUpload(true);
    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.75);
      if (!isSizeSafe(compressedBase64)) {
        alert("عذراً، حجم هذه الصورة كبير جداً. يرجى اختيار صورة أخرى.");
        return;
      }
      setBase64Media(compressedBase64);
    } catch (err) {
      console.error("Failed to compress order discussion image:", err);
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isSizeSafe(result)) {
          setBase64Media(result);
        } else {
          alert("حجم الصورة كبير جداً، يرجى مراجعة الجودة.");
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setPendingUpload(false);
    }
  };

  return (
    <div className="bg-white border rounded-3xl overflow-hidden shadow-md flex flex-col h-[350px] font-sans" dir="rtl">
      {/* Header info */}
      <div className="bg-slate-800 text-white p-3.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-[11px] font-extrabold">المحادثة المباشرة مع {userType === "customer" ? "المطبخ 👨‍🍳" : "الزبون 👤"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>
          <span className="text-[10px] text-slate-300 font-bold">بث مباشر للطلب</span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
            <span className="text-[10px] text-slate-400 font-bold">جاري تحميل المحادثة...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-300" />
            <div>
              <p className="text-[11px] font-extrabold text-slate-700">لا توجد رسائل بعد</p>
              <p className="text-[9.5px] text-slate-400 max-w-[80%] mx-auto">تواصل بخصوص أي ملاحظات عن الوجبة، التحضير، أو الدليفري والسرعة.</p>
            </div>
          </div>
        ) : (
          messages.map((ms) => {
            const isMine = ms.senderId === userId;
            return (
              <div key={ms.id} className={`flex flex-col ${isMine ? "items-start" : "items-end"}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[8.5px] text-slate-400 font-bold">
                    {isMine ? `${ms.senderName} (أنا) 👤` : ms.senderName} ({ms.userType === "customer" ? "زبون" : "المطبخ"})
                  </span>
                </div>
                <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs font-semibold leading-relaxed shadow-sm ${
                  isMine 
                    ? "bg-orange-600 text-white rounded-tr-none" 
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                }`}>
                  {ms.text && <p className="whitespace-pre-wrap">{ms.text}</p>}
                  {ms.mediaUrl && (
                    <div className="mt-1.5 rounded-lg overflow-hidden border">
                      <img src={ms.mediaUrl} alt="Order pic" className="max-w-full max-h-36 object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
                <span className="text-[8px] text-slate-400 mt-0.5 select-none pr-1">
                  {new Date(ms.createdAt).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Attachment Preview */}
      {base64Media && (
        <div className="bg-slate-100 p-2 border-t flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <img src={base64Media} alt="Thumb" className="w-6 h-6 rounded object-cover" referrerPolicy="no-referrer" />
            <span className="text-[9.5px] text-slate-500">ميزة إرفاق مجهزة للطلب</span>
          </div>
          <button onClick={() => setBase64Media(null)} className="text-red-650 hover:bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
            إلغاء 🗑️
          </button>
        </div>
      )}

      {/* Input panel */}
      <form onSubmit={handleSend} className="p-2 border-t bg-white flex items-center gap-1.5">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="اكتب ملاحظة أو إرشادات للمطبخ..."
          className="flex-grow text-xs border rounded-xl py-2 px-3 focus:outline-none focus:border-orange-500"
        />

        <label className="p-2 border rounded-xl hover:bg-slate-50 cursor-pointer text-slate-500 hover:text-orange-600 transition shrink-0">
          <Image className="w-3.5 h-3.5" />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={pendingUpload} />
        </label>

        <button
          type="submit"
          disabled={pendingUpload || (!newText.trim() && !base64Media)}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5 flip-horizontal" />
        </button>
      </form>
    </div>
  );
}
