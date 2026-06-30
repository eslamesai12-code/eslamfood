import React, { useState, useMemo } from "react";
import { Order } from "../types";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Package, Calendar, DollarSign, Wallet, Star, Percent, CheckCircle, XCircle, ShieldAlert, Award,
  Download, Mail, Loader2, Layers
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface PerformanceReportsProps {
  orders: Order[];
  restaurant?: any;
}

export default function PerformanceReports({ orders, restaurant }: PerformanceReportsProps) {
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "all" | "custom">("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [customEmail, setCustomEmail] = useState(restaurant?.ownerEmail || "");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [subFilter, setSubFilter] = useState<string>("all");

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const now = new Date();
    return orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      if (timeRange === "custom") {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return orderDate >= start && orderDate <= end;
      }
      const diffDays = Math.ceil(Math.abs(now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (timeRange === "7days") return diffDays <= 7;
      if (timeRange === "30days") return diffDays <= 30;
      return true;
    });
  }, [orders, timeRange, fromDate, toDate]);

  const periodStats = useMemo(() => {
    const completed = filteredOrders.filter(o => o.status === "completed");
    const ratedOrders = filteredOrders.filter(o => o.rating && o.rating > 0);
    const avgRating = ratedOrders.length > 0
      ? (ratedOrders.reduce((sum, o) => sum + (o.rating || 0), 0) / ratedOrders.length).toFixed(1)
      : "5.0";

    const discountOrders = filteredOrders.filter(o => (o.discountAppliedTotal || 0) > 0);
    const complaintOrders = filteredOrders.filter(o => (o.rating && o.rating <= 3) || (o.status === "cancelled" && o.cancelReason));

    return {
      totalOrders: filteredOrders.length || 0,
      completedCount: completed.length || 0,
      sales: completed.reduce((sum, o) => sum + (o.totalPrice || 0), 0) || 0,
      cancelledCount: filteredOrders.filter(o => o.status === "cancelled").length || 0,
      avgRating: avgRating,
      discounts: discountOrders.reduce((sum, o) => sum + (o.discountAppliedTotal || 0), 0) || 0,
      complaints: complaintOrders.length || 0,
      cash: filteredOrders.filter(o => o.paymentMethod === "cash").length || 0,
      instapay: filteredOrders.filter(o => o.paymentMethod === "instapay").length || 0
    };
  }, [filteredOrders]);

  const timeRangeText = useMemo(() => {
    if (timeRange === "7days") return "آخر 7 أيام";
    if (timeRange === "30days") return "آخر 30 يوم";
    if (timeRange === "custom") return `من ${fromDate} إلى ${toDate}`;
    return "كل الوقت";
  }, [timeRange, fromDate, toDate]);

  const generateReportPDF = async (isSilent = false) => {
    try {
      if (!isSilent) setIsExporting(true);
      const element = document.getElementById("report-content");
      if (!element) return null;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      if (!isSilent) {
        pdf.save(`تقرير_${restaurant?.name || "مطعم"}.pdf`);
        setIsExporting(false);
      }
      return pdf.output("datauristring");
    } catch (err) {
      setIsExporting(false);
      return null;
    }
  };

  const handleSendEmailReport = async () => {
    setIsSendingEmail(true);
    const pdfData = await generateReportPDF(true);
    try {
      await fetch("/api/send-report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customEmail, pdfBase64: pdfData })
      });
      setEmailStatus({ type: "success", message: "تمت المحاكاة بنجاح!" });
    } catch {
      setEmailStatus({ type: "error", message: "حدث خطأ." });
    }
    setIsSendingEmail(false);
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl" id="report-content">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-orange-600" /> تقارير الأداء الذكية 📊
          </h2>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {["all", "30days", "7days", "custom"].map((t) => (
            <button key={t} onClick={() => setTimeRange(t as any)} className={`text-xs font-bold px-4 py-2 rounded-lg ${timeRange === t ? "bg-white shadow-sm" : "text-slate-500"}`}>
              {t === "all" ? "الكل" : t === "30days" ? "30 يوم" : t === "7days" ? "7 أيام" : "مخصص"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-600 text-white p-6 rounded-3xl shadow-lg">
          <div className="text-sm opacity-80">إجمالي الطلبات الفعلي</div>
          <div className="text-3xl font-black">{periodStats.totalOrders}</div>
        </div>
        <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg">
          <div className="text-sm opacity-80">صافي المبيعات</div>
          <div className="text-3xl font-black">{periodStats.sales.toLocaleString()} ج.م</div>
        </div>
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
          <div className="text-sm opacity-80">متوسط التقييم</div>
          <div className="text-3xl font-black">{periodStats.avgRating} / 5</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border p-4 rounded-2xl">
          <div className="text-[10px] text-slate-400 font-bold">الخصومات الممنوحة</div>
          <div className="text-lg font-black">{periodStats.discounts || 0} ج.م</div>
        </div>
        <div className="bg-white border p-4 rounded-2xl">
          <div className="text-[10px] text-slate-400 font-bold">الشكاوى والبلاغات</div>
          <div className="text-lg font-black text-red-600">{periodStats.complaints || 0}</div>
        </div>
        <div className="bg-white border p-4 rounded-2xl">
          <div className="text-[10px] text-slate-400 font-bold">طلبات ملغاة</div>
          <div className="text-lg font-black">{periodStats.cancelledCount || 0}</div>
        </div>
        <div className="bg-white border p-4 rounded-2xl">
          <div className="text-[10px] text-slate-400 font-bold">طلبات ناجحة</div>
          <div className="text-lg font-black text-emerald-600">{periodStats.completedCount || 0}</div>
        </div>
      </div>

      <div className="flex gap-2 justify-end no-print">
        <button onClick={() => generateReportPDF()} disabled={isExporting} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Download size={16} /> تصدير PDF
        </button>
        <button onClick={() => setShowEmailModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Mail size={16} /> إرسال بريد
        </button>
      </div>

      {showEmailModal && (
        <div className="bg-slate-50 border p-4 rounded-2xl space-y-3">
          <input type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="Email" className="w-full p-2 rounded-lg border" />
          <button onClick={handleSendEmailReport} disabled={isSendingEmail} className="bg-orange-600 text-white w-full py-2 rounded-lg font-bold">
            {isSendingEmail ? "جاري الإرسال..." : "إرسال الآن 🚀"}
          </button>
          {emailStatus.message && <div className="text-xs font-bold text-center">{emailStatus.message}</div>}
        </div>
      )}
    </div>
  );
}
