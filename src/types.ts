export interface MenuItem {
  id: string;
  category: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  isAvailable: boolean;
  options?: { name: string; price: number }[];
  originalPrice?: number;
}

export interface DailyHours {
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "23:00"
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue?: number;
  isActive: boolean;
}

export interface Restaurant {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  phone: string;
  address: string;
  image?: string;
  lat: number;
  lng: number;
  deliveryRadius?: number; // Delivery zone radius in kilometers
  createdAt: string;
  trialEndsAt: string;
  status: 'trial' | 'active' | 'expired' | 'pending_approval';
  paymentSenderNumber?: string;
  paymentTransactionId?: string;
  paymentSubmittedAt?: string;
  subscriptionExpiresAt?: string;
  deliveryFee?: number;
  dineInFee?: number;
  pickupFee?: number;
  workingHours?: Record<string, DailyHours>;
  allowVodafoneCash?: boolean;
  allowVisa?: boolean;
  allowInstapay?: boolean;
  allowCash?: boolean;
  allowDineIn?: boolean;
  allowPickup?: boolean;
  allowDelivery?: boolean;
  slug?: string;
  welcomeMessage?: string;
  loyaltyEnabled?: boolean;
  pointsPerTenEgp?: number;
  pointValueEgp?: number;
  // Social media and dynamic timer settings
  facebookUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  instagramUrl?: string;
  snapchatUrl?: string;
  googleMapsUrl?: string;
  googleReviewUrl?: string;
  customUrlLabel?: string;
  customUrl?: string;
  currency?: string;
  theme?: 'dark' | 'warm' | 'bold' | 'minimal' | 'vibrant' | 'elegant';
  taxPercentage?: number;
  targetPrepTimeMinutes?: number; // Target preparation duration before an order is flagged as late
  businessType?: 'restaurant' | 'accessories' | 'supermarket' | 'clothing' | 'other';
  pricingPlan?: 'standard' | 'premium';
  customAppName?: string;
  customAppIcon?: string;
  pendingPlanType?: 'standard' | 'premium';
  pendingPlanDurationMonths?: 1 | 3 | 6 | 12;
  coupons?: Coupon[];
  isClosedManual?: boolean;
  closeReason?: 'temporarily_closed' | 'busy' | 'no_delivery_drivers' | 'custom' | string;
  closeCustomMessage?: string;
  facebookPixelId?: string;
  catalogFeedEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  pushWelcomeTitle?: string;
  pushWelcomeBody?: string;
  smartSectionsEnabled?: boolean;
  aiImagesGeneratedCount?: number;
  tablesCount?: number;
  extraTablesPaid?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  selectedOptions?: { name: string; price: number }[];
}

export interface Order {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  customerAge?: number;
  customerGovernorate?: string;
  customerStreet?: string;
  orderType: 'delivery' | 'dine_in' | 'pickup';
  tableNumber?: string;
  deliveryAddress?: string;
  pickupBranchId?: string;
  pickupBranchName?: string;
  paymentMethod?: 'visa' | 'cash' | 'instapay' | 'vodafone_cash';
  paymentScreenshot?: string; // Base64 representation of payment screenshot
  items: OrderItem[];
  totalPrice: number;
  deliveryFee?: number;
  dineInFee?: number;
  pickupFee?: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  cancelReason?: string;
  cancelledBy?: 'owner' | 'customer';
  createdAt: string;
  rating?: number;
  reviewComment?: string;
  ratedAt?: string;
  acceptedBy?: {
    name: string;
    email: string;
    role: 'agent' | 'team_leader' | 'shift_manager';
    acceptedAt: string;
  };
  assignedTo?: {
    name: string;
    email: string;
    assignedAt: string;
  };
  loyaltyPointsUsed?: number;
  loyaltyDiscountApplied?: number;
  loyaltyPointsEarnedEstimated?: number;
  couponCode?: string;
  couponDiscountApplied?: number;
  discountAppliedTotal?: number;
  dailyOrderNumber?: string;
  dailySerial?: number;
  ownerNotes?: string;
  driverLat?: number;
  driverLng?: number;
  driverStatus?: 'idle' | 'picked_up' | 'approaching' | 'delivered';
}

export interface CallCenterMember {
  email: string;
  password?: string;
  name: string;
  role: 'agent' | 'team_leader' | 'shift_manager';
  restaurantId: string;
  createdAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  governorate: string;
  address: string;
  phone: string;
  pricingPlan?: 'standard' | 'golden_ai';
  deliveryFee?: number;
  dineInFee?: number;
  pickupFee?: number;
  paymentSenderNumber?: string;
  paymentTransactionId?: string;
  lat?: number;
  lng?: number;
  disabledTabs?: string[];
}

export interface AdminSettings {
  vodafoneCashNumber: string;
  subscriptionFee: number;
  updatedAt: string;
  appBannerUrl1?: string;
  appBannerUrl2?: string;
  appBannerUrl3?: string;
  appMainLogo?: string;
  monthlyBillingOpen?: boolean;
  monthlyBillingMonth?: string;
  broadcastCustomersMessage?: string;
  broadcastOwnersMessage?: string;
  // Plan-specific prices set by Admin
  planStandard1MonthFee?: number;
  planStandard3MonthsFee?: number;
  planStandard6MonthsFee?: number;
  planStandard12MonthsFee?: number;
  planPremium1MonthFee?: number;
  planPremium3MonthsFee?: number;
  planPremium6MonthsFee?: number;
  planPremium12MonthsFee?: number;
  // Menu Ad controls
  menuAdZoomScale?: number;
  menuAdFitMode?: "contain" | "cover";
  adPrice1Day?: number;
  adPrice2Days?: number;
  adPrice7Days?: number;
  adPrice30Days?: number;
  // Dynamic controls requested by Founder / Platform Owner
  dbConfigUrl?: string; // رابط قاعدة البيانات وسحابتها الرئيسي
  officialWhatsAppSupportLink?: string; // رابط واتساب الدعم الفني
  officialTelegramSupportLink?: string; // رابط تيليجرام
  dashboardTutorialVideo?: string; // رابط فيديو الشرح
  defaultFreeTrialDays?: number; // عداد أو مدة الفترة التجريبية بالأيام
  maxBranchesAllowed?: number; // عداد الحد الأقصى للفروع
  maxMenuProductsAllowed?: number; // عداد الحد الأقصى للمنتجات
  supportAgentPhoneNumber?: string; // هاتف الدعم التنسيقي
  // Dynamic Server & DB Config (GEMINI & Database)
  geminiApiKey?: string;
  serverBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  databaseConnectionString?: string;
  // Feature Access Permissions per Pricing Plan
  standardAllowCoupons?: boolean;
  standardAllowLoyaltyPoints?: boolean;
  standardAllowCallCenter?: boolean;
  standardAllowPopups?: boolean;
  standardAllowLiveChat?: boolean;
  standardAllowLiveChatSupport?: boolean; // added support chat toggle
  standardAllowBranches?: boolean;
  premiumAllowCoupons?: boolean;
  premiumAllowLoyaltyPoints?: boolean;
  premiumAllowCallCenter?: boolean;
  premiumAllowPopups?: boolean;
  premiumAllowLiveChat?: boolean;
  premiumAllowLiveChatSupport?: boolean; // added support chat toggle
  premiumAllowBranches?: boolean;
  // Dynamic typography & chat styles
  chatTextColor?: string;
  chatBubbleColor?: string;
  platformFontFamily?: string;
  platformFontSize?: string;
  // Bot & Automated Notifications config
  botActive?: boolean;
  botIntervalSeconds?: number;
  botOwnerNumbers?: string;
  botCustomerNumbers?: string;
  botTips?: string[];
  deliveryServicesSuspended?: boolean;
}

export interface WhatsAppStatus {
  id: string;
  restaurantId: string;
  mediaUrl: string; // Base64 or general URL (image/video)
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: string; // 24 hours duration
  viewsCount?: number;
  viewers?: string[];
}

export interface ChatMessage {
  id: string;
  text: string;
  mediaUrl?: string; // Optional image attached
  senderId: string; // "customer", "owner", etc.
  senderName: string;
  createdAt: string;
}

export interface MarketingAgent {
  id: string;
  restaurantId: string;
  name: string;
  age: number;
  address: string;
  governorate: string;
  monthlySubscriptionsCount: number; // Subscriptions count brought this month
  commissionPercentage: number; // E.g., 10%
  targetSubscriptions: number; // E.g., 20 target
  registeredAt: string;
  performanceHistory?: {
    month: string; // "YYYY-MM"
    subscriptionsCount: number;
    commissionPaid: number;
    bonusEarned: number;
  }[];
}
