import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Play, Pause, X, ChevronRight, ChevronLeft, Plus, Image, Film, Loader2, Calendar, Volume2, VolumeX, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { compressImage, isSizeSafe } from "../lib/imageCompressor";

interface StatusItem {
  id: string;
  restaurantId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
}

interface WhatsAppStatusWidgetProps {
  restaurantId: string;
  isOwner?: boolean; // If true, render status uploading and management panel
  customerName?: string;
  customerPhone?: string;
}

export default function WhatsAppStatusWidget({ 
  restaurantId, 
  isOwner = false,
  customerName = "عميل زائر",
  customerPhone = ""
}: WhatsAppStatusWidgetProps) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressTimerRef = useRef<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(false); // Default to unmuted when story changes
    if (activeStoryIndex !== null && statuses[activeStoryIndex]) {
      const activeItem = statuses[activeStoryIndex];
      const docRef = doc(db, "statuses", activeItem.id);
      updateDoc(docRef, {
        viewsCount: (activeItem.viewsCount || 0) + 1
      }).catch(err => console.error("Error updating story viewsCount:", err));
    }
  }, [activeStoryIndex]);

  useEffect(() => {
    if (activeStoryIndex !== null && statuses[activeStoryIndex]?.mediaType === "video" && videoRef.current) {
      const video = videoRef.current;
      video.muted = isMuted;
      
      if (isPaused) {
        video.pause();
      } else {
        video.play().catch((err) => {
          console.warn("Autoplay with audio blocked. Playing muted instead.", err);
          if (!isMuted) {
            setIsMuted(true);
          }
        });
      }
    }
  }, [activeStoryIndex, isMuted, isPaused, statuses]);

  // States for owner creator
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorMediaType, setCreatorMediaType] = useState<"image" | "video">("image");
  const [creatorMediaUrl, setCreatorMediaUrl] = useState("");
  const [creatorCaption, setCreatorCaption] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const [storyReply, setStoryReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const handleSendStoryReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!storyReply.trim() || activeStoryIndex === null) return;

    setIsSendingReply(true);
    try {
      const activeItem = statuses[activeStoryIndex];
      await addDoc(collection(db, "ad_story_replies"), {
        type: "story",
        itemId: activeItem.id,
        itemMedia: activeItem.mediaUrl || "",
        itemText: activeItem.caption || "حالة بدون تعليق",
        restaurantId,
        customerName,
        customerPhone,
        replyText: storyReply.trim(),
        createdAt: new Date().toISOString()
      });
      setStoryReply("");
      alert("تم إرسال ردك بنجاح لصاحب المطعم! 💬🎉");
      setIsPaused(false);
    } catch (err) {
      console.error("Error sending status reply:", err);
      alert("فشل في إرسال الرد. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Real-time listen to statuses
  useEffect(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const q = query(
      collection(db, "statuses"),
      where("restaurantId", "==", restaurantId),
      where("createdAt", ">=", twentyFourHoursAgo)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StatusItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as StatusItem);
      });
      // Sort manually by creation date asc
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setStatuses(list);
    }, (err) => {
      console.error("Error loading whatsapp statuses:", err);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  // Story player progression logic
  useEffect(() => {
    if (activeStoryIndex === null) {
      setProgress(0);
      return;
    }

    if (isPaused) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    const isVideo = statuses[activeStoryIndex]?.mediaType === "video";
    const intervalTime = 100; // Tick every 100ms

    progressTimerRef.current = setInterval(() => {
      if (isVideo && videoRef.current) {
        const video = videoRef.current;
        if (video.duration) {
          const pct = (video.currentTime / video.duration) * 100;
          setProgress(Math.min(pct, 100));
        }
      } else {
        const totalDuration = 6000; // 6 seconds per story
        const increment = (intervalTime / totalDuration) * 100;
        setProgress((prev) => {
          if (prev >= 100) {
            handleNextStory();
            return 0;
          }
          return prev + increment;
        });
      }
    }, intervalTime);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [activeStoryIndex, isPaused, statuses]);

  const handleNextStory = () => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex < statuses.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
      setProgress(0);
    } else {
      setActiveStoryIndex(null); // Close player at end
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  };

  // Support creator file uploads
  const handleCreatorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isVideo = file.type.startsWith("video/") || 
                    fileName.endsWith(".mp4") || 
                    fileName.endsWith(".mov") || 
                    fileName.endsWith(".avi") || 
                    fileName.endsWith(".mkv") || 
                    fileName.endsWith(".webm") || 
                    fileName.endsWith(".3gp") || 
                    fileName.endsWith(".qt") || 
                    fileName.endsWith(".hevc");
    
    if (isVideo) {
      // Check file size immediately before reading (safe size within Firestore 1MB document limit)
      const maxBytes = 520 * 1024; // 520 KB safe raw size
      if (file.size > maxBytes) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        alert(`تنبيـه هام لسرعة المتجر: حجم الفيديو المحدد (${sizeMb} ميجابايت) كبير جداً.\n\nمن فضلك ارفع فيديو أقصر من ثانيتين بجودة متواضعة جداً ليكون حجم الملف أقل من 500 كيلوبايت، حتى يعمل بشكل فوري لزبائنك دون تهنيج أو استهلاك لباقاتهم، أو يمكنك ببساطة لصق "رابط مباشر" للفيديو وسيعمل طوال اليوم بشكل ممتاز!`);
        return;
      }
      setCreatorMediaType("video");
      setIsPublishing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Check base64 character length directly (stored as string in Firestore, 1 char = 1 byte)
        if (result.length > 740 * 1024) {
          alert("تنبيه: حجم الفيديو بعد التشفير يتجاوز 740 كيلوبايت. يرجى اختيار فيديو أقصر أو بجودة أقل، أو لصق رابط فيديو مباشر.");
          setIsPublishing(false);
          return;
        }
        setCreatorMediaUrl(result);
        setIsPublishing(false);
      };
      reader.onerror = () => {
        setIsPublishing(false);
        alert("عذراً، فشل في قراءة ملف الفيديو من جهازك.");
      };
      reader.readAsDataURL(file);
    } else {
      setCreatorMediaType("image");
      setIsPublishing(true);
      try {
        // Compress and downscale using canvas
        const compressedBase64 = await compressImage(file, 800, 800, 0.75);
        setCreatorMediaUrl(compressedBase64);
      } catch (err) {
        console.error("Compression error:", err);
        // Fallback to reading file directly as base64 if canvas fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setCreatorMediaUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsPublishing(false);
      }
    }
  };

  const handlePublishStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorMediaUrl) {
      alert("يرجى اختيار ميديا أو تزويد رابط صالح أولاً.");
      return;
    }

    if (!isSizeSafe(creatorMediaUrl)) {
      alert("عذراً، حجم هذه الميديا يتجاوز الحد المسموح به (٨٥٠ كيلوبايت) لضمان الأمان وسرعة الأداء.");
      return;
    }

    setIsPublishing(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Expires in 24 hours

      await addDoc(collection(db, "statuses"), {
        restaurantId,
        mediaUrl: creatorMediaUrl,
        mediaType: creatorMediaType,
        caption: creatorCaption,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      setCreatorMediaUrl("");
      setCreatorCaption("");
      setIsCreatorOpen(false);
      alert("تم نشر الحالة (الستوري) بنجاح! 📱 ستظهر الحالة لجميع عملائك لمدة ٢٤ ساعة القادمة.");
    } catch (err) {
      console.error("Failed to add status story:", err);
      alert("حدث خطأ أثناء تحميل الستوري.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه الحالة للأبد ومنع العملاء من مشاهدتها؟")) return;
    try {
      await deleteDoc(doc(db, "statuses", statusId));
      alert("موافق! تم حذف الستوري.");
    } catch (err) {
      console.error("Error deleting status:", err);
    }
  };

  return (
    <div className="font-sans text-right" dir="rtl">
      {/* 1. Client View UI: Tray of Circular Stories */}
      {!isOwner ? (
        statuses.length > 0 && (
          <div className="py-4 border-y border-slate-100 bg-white/60 mb-4 px-1" dir="rtl">
            <h4 className="text-[11px] font-black text-slate-405 pr-3 mb-2 flex items-center gap-1">
              📱 قصص وحالات المطبخ (مباشر) ينتهي بعد ٢٤ ساعة
            </h4>
            <div className="flex gap-4 overflow-x-auto px-2 py-1 scrollbar-none scroll-smooth">
              <div 
                onClick={() => setActiveStoryIndex(0)}
                className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-orange-500 via-red-500 to-amber-400 active:scale-90 transition transform">
                  <div className="p-0.5 bg-white rounded-full">
                    <img 
                      src={statuses[0].mediaUrl} 
                      alt="Story"
                      className="w-14 h-14 rounded-full object-cover ring-1 ring-slate-100"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] text-white p-0.5 px-1 rounded-full font-black flex items-center gap-0.5">
                    {statuses.length} ستوري
                  </span>
                </div>
                <span className="text-[10px] font-black text-slate-800">حالات المطبخ ✨</span>
              </div>
            </div>
          </div>
        )
      ) : (
        /* 2. Management Panel for the Restaurant Owner */
        <div className="bg-white border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                📱 حالات وقصص المطبخ لزبائنك (ستوري واتساب)
              </h3>
              <p className="text-[10px] text-slate-400">انشر إعلانات، وجبات جديدة، أو جودة المطبخ تظهر فوراً للعملاء لمدة ٢٤ ساعة.</p>
            </div>
            <button
              onClick={() => setIsCreatorOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[10.5px] px-3.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>نشر حالة جديدة 📱</span>
            </button>
          </div>

          {statuses.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">مطبخك لا يتوفر على حالات ستوري نشطة حالياً. انشر أول حالة لجذب انتباه العملاء!</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statuses.map((item) => (
                <div key={item.id} className="relative group border rounded-2xl overflow-hidden hover:shadow-md transition">
                  {item.mediaType === "video" ? (
                    <div className="relative w-full h-32 bg-black flex items-center justify-center">
                      <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                      <span className="absolute top-1.5 left-1.5 bg-black/50 text-[8px] text-white p-0.5 px-1.5 rounded-full flex items-center gap-0.5">
                        <Film className="w-2.5 h-2.5" /> فيديو
                      </span>
                    </div>
                  ) : (
                    <img src={item.mediaUrl} alt="Store doc" className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="p-2 space-y-1 bg-white">
                    <p className="text-[10px] font-bold text-slate-700 truncate">{item.caption || "بدون شرح"}</p>
                    <p className="text-[8px] text-slate-400">نُشرت: {new Date(item.createdAt).toLocaleTimeString("ar-EG")}</p>
                    <button
                      onClick={() => handleDeleteStatus(item.id)}
                      className="w-full mt-1 bg-red-50 text-red-650 hover:bg-red-100 text-[9px] py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      حذف الحالة 🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interactive Story creator modal */}
          <AnimatePresence>
            {isCreatorOpen && (
              <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl max-w-md w-full p-6 text-right space-y-4"
                >
                  <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                      📱 صانع إعلانات وقصص المطبخ
                    </h3>
                    <button onClick={() => setIsCreatorOpen(false)} className="text-slate-400 hover:text-slate-800">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handlePublishStatus} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">١. اختر ملف ميديا للحالة (صورة أو فيديو) *</label>
                      <div className="flex gap-2">
                        <label className="flex-1 border-2 border-dashed border-slate-250 hover:border-orange-500 rounded-2xl p-4 cursor-pointer text-center space-y-1 hover:bg-slate-50/50 transition">
                          {creatorMediaUrl ? (
                            <div className="space-y-1.5">
                              {creatorMediaType === "video" ? (
                                <video src={creatorMediaUrl} className="max-h-24 mx-auto rounded object-cover" muted />
                              ) : (
                                <img src={creatorMediaUrl} alt="Attached story" className="max-h-24 mx-auto rounded object-cover" referrerPolicy="no-referrer" />
                              )}
                              <span className="text-[10px] text-orange-600 font-extrabold block">تم اختيار الملف بنجاح! انقر للاستبدال</span>
                            </div>
                          ) : (
                            <>
                              <Plus className="w-6 h-6 mx-auto text-slate-450 animate-bounce" />
                              <span className="text-[10px] text-slate-500 font-bold block">انقر لرفع صورة أو فيديو 🖼️🎥</span>
                            </>
                          )}
                          <input type="file" accept="image/*,video/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleCreatorFileUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">رابط ميديا بديل (اختياري)</label>
                      <input
                        type="url"
                        value={creatorMediaUrl.startsWith("data:") ? "" : creatorMediaUrl}
                        onChange={(e) => {
                          setCreatorMediaUrl(e.target.value);
                          setCreatorMediaType(e.target.value.toLowerCase().includes("mp4") ? "video" : "image");
                        }}
                        placeholder="أو الصق رابط صورة أو فيديو مباشر جاهز"
                        className="w-full text-xs border rounded-lg py-2 px-3 text-left font-mono"
                        dir="ltr"
                      />
                      <div className="bg-amber-50 border border-amber-200 text-amber-905 rounded-xl p-3 text-[10px] leading-relaxed text-right font-medium">
                        💡 <strong>لنشر فيديو حتـى ٢٩ ثانية كاملة بصوت وصورة واضحة:</strong>
                        <p className="mt-1">
                          قاعدة بيانات المتجر تفرض حداً أقصى للملفات المرفوعة مباشرة من الجهاز (أقل من 500 كيلوبايت لضمان سرعة المتجر لعملائك). 
                          <br />
                          <strong>الحل فائق السهولة:</strong> ارفع الفيديو الخاص بك على أي منصة تواصل أو موقع رفع، ثم الصق رابطه المباشر بالخانة أعلاه. قمنا بتطوير نظام التشغيل ليتعرف على الفيديو ذو الـ ٢٩ ثانية تلقائياً ويقوم بتحريك شريط الهامش بالتزامن وعرضه بالكامل دون انقطاع!
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">٢. شرح أو عنوان الحالة (اختياري)</label>
                      <textarea
                        value={creatorCaption}
                        onChange={(e) => setCreatorCaption(e.target.value)}
                        placeholder="اكتب شرحاً جذابًا يظهر أسفل الستوري..."
                        className="w-full text-xs border rounded-lg py-2 px-3 h-20 resize-none font-medium leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isPublishing || !creatorMediaUrl}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-350 text-white font-black py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>جاري النشر ومزامنة البيانات...</span>
                        </>
                      ) : (
                        <span>نشر الحالة للجمهور حالاً 🚀</span>
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 3. Fullscreen Premium Story Player Modal */}
      <AnimatePresence>
        {activeStoryIndex !== null && (
          <div className="fixed inset-0 bg-black/95 z-55 flex flex-col justify-between p-4 pb-12 select-none" dir="rtl">
            <div className="max-w-md w-full mx-auto relative h-full flex flex-col justify-between">
              
              {/* Overlaid progresses header */}
              <div className="absolute top-2 left-0 right-0 z-56 px-2 space-y-3.5">
                {/* Steppers progress indicators */}
                <div className="flex gap-1.5 justify-center">
                  {statuses.map((_, index) => (
                    <div key={index} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-[100ms] ease-linear"
                        style={{ 
                          width: index < activeStoryIndex 
                            ? "100%" 
                            : index === activeStoryIndex 
                              ? `${progress}%` 
                              : "0%" 
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Sender card detail triggers */}
                <div className="flex items-center justify-between text-white" dir="rtl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 p-0.5 border border-orange-500 flex items-center justify-center text-xs font-black">
                      👨‍🍳
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black">قصص وحالات المطبخ</h4>
                      <p className="text-[8px] text-white/60">نشر: {new Date(statuses[activeStoryIndex].createdAt).toLocaleTimeString("ar-EG")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {statuses[activeStoryIndex].mediaType === "video" && (
                      <button 
                        onClick={() => setIsMuted(!isMuted)} 
                        className="text-white hover:text-orange-500 bg-white/10 hover:bg-white/20 rounded-full p-2"
                        title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-green-400" />}
                      </button>
                    )}
                    <button 
                      onClick={() => setIsPaused(!isPaused)} 
                      className="text-white hover:text-orange-500 bg-white/10 hover:bg-white/20 rounded-full p-2"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => setActiveStoryIndex(null)}
                      className="text-white hover:text-red-500 bg-white/10 hover:bg-white/20 rounded-full p-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Media Body Container */}
              <div 
                className="flex-grow flex items-center justify-center p-2 mt-16 relative"
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
              >
                {/* Click Navigations triggers left/right split */}
                <div 
                  onClick={handlePrevStory}
                  className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-55 flex items-center justify-start p-2 opacity-0 hover:opacity-100 transition"
                >
                  <div className="bg-white/10 p-2 rounded-full text-white">
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>

                <div 
                  onClick={handleNextStory}
                  className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-55 flex items-center justify-end p-2 opacity-0 hover:opacity-100 transition"
                >
                  <div className="bg-white/10 p-2 rounded-full text-white">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {statuses[activeStoryIndex].mediaType === "video" && isMuted && (
                  <button 
                    onClick={() => setIsMuted(false)}
                    className="absolute bg-black/75 hover:bg-black/90 text-white font-black text-[11px] px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 transition animate-pulse z-57"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-red-500" />
                    <span>انقر لتشغيل الصوت 🔊</span>
                  </button>
                )}

                {statuses[activeStoryIndex].mediaType === "video" ? (
                  <video 
                    ref={videoRef}
                    src={statuses[activeStoryIndex].mediaUrl} 
                    className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/5" 
                    autoPlay 
                    playsInline 
                    muted={isMuted}
                    loop={false}
                    onEnded={handleNextStory}
                  />
                ) : (
                  <img 
                    src={statuses[activeStoryIndex].mediaUrl} 
                    alt="Active story" 
                    className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/5"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Caption overlay */}
              {statuses[activeStoryIndex].caption && (
                <div className="bg-gradient-to-t from-black/80 via-black/45 to-transparent text-white p-4 pb-4 rounded-2xl text-center space-y-1">
                  <p className="text-xs font-bold leading-relaxed tracking-wide px-2 whitespace-pre-wrap">
                    {statuses[activeStoryIndex].caption}
                  </p>
                </div>
              )}

              {/* Story Reply Section */}
              {!isOwner && (
                <form 
                  onSubmit={handleSendStoryReply} 
                  className="p-3 bg-slate-900/90 border-t border-white/10 flex items-center gap-2 z-56"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input 
                    type="text"
                    value={storyReply}
                    onChange={(e) => setStoryReply(e.target.value)}
                    onFocus={() => setIsPaused(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!storyReply) setIsPaused(false);
                      }, 200);
                    }}
                    placeholder="ردّ على هذه القصة بسؤال أو تعليق... 💬"
                    className="flex-grow bg-white/10 text-white rounded-full px-4 py-2.5 text-xs outline-none border border-white/10 focus:border-orange-500 transition placeholder-white/40"
                  />
                  <button
                    type="submit"
                    disabled={isSendingReply || !storyReply.trim()}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 text-white p-2.5 rounded-full transition active:scale-95 flex items-center justify-center shrink-0"
                  >
                    {isSendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </form>
              )}
              
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
