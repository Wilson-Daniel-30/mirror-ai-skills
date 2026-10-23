/**
 * COMMITTED LAYOUT TEMPLATE — API contract drift canvas (Superapp Jamaica reference).
 *
 * Agents running `api report <market>`:
 * - COPY this file to `{cursor-project}/canvases/<slug>-api-contract-drift.canvas.tsx` when no canvas exists.
 * - If a local canvas already exists: update ONLY data blocks (META, KPIS, BASELINE_HEADERS, APIS, STALE) and derived counts — do NOT rewrite layout, helpers, or Table column sets.
 * - Do NOT edit this template file to “fix” a compile error in someone’s local canvas — fix the local file (style `{{ }}`) or re-copy helpers from here.
 * - Never drop inventory columns to fix errors (8 columns per path table — see docs/10).
 *
 * Maintainers: update this file only in a deliberate workspace PR when the canonical layout changes.
 */
import {
  BarChart,
  CollapsibleSection,
  Divider,
  Grid,
  H1,
  H3,
  Row,
  Stack,
  Stat,
  Swatch,
  Table,
  Text,
  UsageBar,
  useHostTheme,
  useMemo,
  type Color,
  type TableRowTone,
} from "cursor/canvas";

type Contract = "same" | "drift" | "android-only" | "ios-only";
type Risk = "low" | "medium" | "high";
type Category = "Auth" | "Account" | "Storefront" | "Payments" | "Loyalty" | "Comms";

type ApiRow = {
  path: string;
  category: Category;
  contract: Contract;
  drift: string[];
  risk: Risk;
  android: string;
  ios: string;
  notes: string;
  androidExtra: string;
  iosExtra: string;
};

type BaselineRow = {
  header: string;
  android: string;
  ios: string;
  status: string;
  tag: string;
};

const META = {
  generated: "2026-10-07",
  market: "Superapp Caribbean \u2014 Jamaica (JM)",
  sprint: "Jamaica/feature/development",
  androidSha: "0b03ae1f",
  iosSha: "3124b4e0",
  bffPrefix: "/api/metac-app-bff/v1/",
  host: "superapp.core.metac.libertyuconnect.com",
  hostMatch: "same",
  tenantId: "JM",
  androidBaselineEvidence: "core/network/src/main/java/com/core/network/intercepter/HeaderInterceptor.kt @ 0b03ae1f",
  iosBaselineEvidence: "LLA-SuperApp-iOS/Core/Networking/Config/HTTPHeaders.swift @ 3124b4e0",
};

const KPIS = {
  total: 97,
  same: 70,
  drift: 7,
  androidOnly: 18,
  iosOnly: 2,
  highRisk: 5,
  stale: 8,
};

const BASELINE_HEADERS: BaselineRow[] = [
  { header: "Authorization", android: "Bearer accessToken (refresh token on auth/refresh-token)", ios: "Bearer accessToken (refresh fallback if access empty)", status: "Same", tag: "\u2014" },
  { header: "uid", android: "uid (lowercase header name)", ios: "UID (uppercase header name)", status: "Drift", tag: "CASE" },
  { header: "Content-Type", android: "application/json", ios: "application/json", status: "Same", tag: "\u2014" },
  { header: "Accept", android: "application/json", ios: "*/*", status: "Drift", tag: "HDR" },
  { header: "appLanguage", android: "\"es\" hardcoded (HeaderInterceptor.kt:44)", ios: "Locale.current languageCode (default en)", status: "Drift", tag: "HDR" },
  { header: "tenantId", android: "JM (BuildConfig.TENANT_ID)", ios: "JM (TenantConfig.current.rawValue)", status: "Same", tag: "\u2014" },
  { header: "appName", android: "Flow + (BuildConfig.APP_NAME)", ios: "My Flow Self Care (HeaderValue.appNameDefault)", status: "Drift", tag: "HDR" },
  { header: "appVersion", android: "BuildConfig.VERSION_NAME", ios: "Bundle.main.marketingVersionString", status: "Same", tag: "\u2014" },
  { header: "appVersionCode", android: "BuildConfig.VERSION_CODE", ios: "Bundle.main.buildVersionNumber", status: "Same", tag: "\u2014" },
  { header: "channel", android: "APP", ios: "APP", status: "Same", tag: "\u2014" },
  { header: "deviceId", android: "prefHelper.getDeviceId()", ios: "identifierForVendor UUID", status: "Same", tag: "\u2014" },
  { header: "deviceType", android: "android", ios: "iOS", status: "Same", tag: "\u2014" },
  { header: "deviceName", android: "${MANUFACTURER} ${MODEL}", ios: "UIDevice.current.name", status: "Same", tag: "\u2014" },
  { header: "OSNAME", android: "Android", ios: "iOS (Header.osName)", status: "Same", tag: "\u2014" },
  { header: "OSVERSION", android: "Build.VERSION.RELEASE", ios: "UIDevice.current.systemVersion", status: "Same", tag: "\u2014" },
  { header: "OSMODELNAME", android: "Build.VERSION_CODES field name", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "OSPRODUCTNAME", android: "Build.PRODUCT", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "OSFIRMWAREBUILD", android: "Build.DISPLAY", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "reqId", android: "generateRandomNumber()", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "mmReqIdentifier", android: "SecurityInterceptor only", ios: "random Int64 in standardHeaders", status: "Drift", tag: "HDR" },
  { header: "sessionId", android: "prefHelper.getSessionId()", ios: "UserDefaultsManager.shared.sessionId", status: "Same", tag: "\u2014" },
  { header: "uniqueId", android: "prefHelper.getUniqueId()", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "digitalKey", android: "SecurityInterceptor RSA wrap (PreProd+Prod)", ios: "HTTPHeaders.standardHeaders RSA wrap", status: "Same", tag: "\u2014" },
  { header: "Strict-Transport-Security", android: "max-age=63072000; includeSubDomains; preload", ios: "\u2014 (not sent)", status: "Drift", tag: "HDR" },
  { header: "Accept-Encoding", android: "identity", ios: "\u2014 (URLSession default)", status: "Drift", tag: "HDR" },
  { header: "transactionId", android: "optional (NotificationCache)", ios: "\u2014", status: "Drift", tag: "HDR" },
  { header: "intent", android: "optional (NotificationCache)", ios: "\u2014", status: "Drift", tag: "HDR" },
  { header: "campaignId", android: "optional (NotificationCache)", ios: "\u2014", status: "Drift", tag: "HDR" },
  { header: "conversionType", android: "optional (NotificationCache)", ios: "\u2014", status: "Drift", tag: "HDR" },
  { header: "Dynatrace tag", android: "DynatraceInterceptor", ios: "\u2014", status: "Drift", tag: "HDR" },
];

const APIS: ApiRow[] = [
  { path: "login", category: "Auth", contract: "same", drift: [], risk: "low", android: "loginId, password, loginMode, biometric", ios: "same fields", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "otp-login", category: "Auth", contract: "same", drift: [], risk: "low", android: "code, phone, flow, biometric", ios: "code, loginId, vtoken, biometric", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "auth/refresh-token", category: "Auth", contract: "same", drift: [], risk: "low", android: "{}", ios: "EmptyRequest", notes: "Refresh token in Authorization", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "auth/logout", category: "Auth", contract: "same", drift: [], risk: "low", android: "{}", ios: "{}", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "registration/account-search-send-otp", category: "Auth", contract: "same", drift: [], risk: "low", android: "phone/email search", ios: "same shape", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "send-otp-lambda", category: "Auth", contract: "same", drift: [], risk: "low", android: "phone, hash, accion, sms", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "registration/register-and-login", category: "Auth", contract: "same", drift: [], risk: "low", android: "code, loginId, mode, vtoken", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "registration/set-account-info", category: "Auth", contract: "same", drift: [], risk: "low", android: "password or link-mobile", ios: "password or mode: link-account-mobile", notes: "iOS reuses for mobile link", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "recover-password/*", category: "Auth", contract: "same", drift: [], risk: "low", android: "standard recover flow", ios: "same", notes: "3 paths", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "registration/get-account-info", category: "Auth", contract: "same", drift: [], risk: "low", android: "uid in body", ios: "GetAccountInfoRequest(uid)", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "link-account-fixed", category: "Auth", contract: "same", drift: [], risk: "low", android: "residential link fields", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "link-account-mobile", category: "Auth", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "LinkAccountMobileRequest", ios: "\u2014", notes: "iOS uses set-account-info with mode instead", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "otp-update-and-set-link-account", category: "Auth", contract: "drift", drift: ["ROUTE", "BODY"], risk: "high", android: "single combined request", ios: "chains otp-update + set-account-info", notes: "Different orchestration for same journey", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "otp-update", category: "Auth", contract: "same", drift: [], risk: "low", android: "OTP verify", ios: "code, vtoken", notes: "", androidExtra: "baseline", iosExtra: "(UID header + body uid)" },
  { path: "send-otp", category: "Auth", contract: "ios-only", drift: ["ROUTE"], risk: "low", android: "integrated (unused)", ios: "stale constant", notes: "Resend uses send-otp-lambda", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "auth/integrity-check", category: "Auth", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "IntegrityCheckRequest", ios: "\u2014", notes: "Play Integrity; no iOS wiring", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "get-home-screen-data", category: "Account", contract: "same", drift: [], risk: "low", android: "accountNumbers: [String]", ios: "accountNumbers: [String]", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "get-account-data-details", category: "Account", contract: "drift", drift: ["TYPE", "BODY"], risk: "medium", android: "accountNumber, msisdn, lob, serviceType (enum)", ios: "same fields; serviceType String; E.164 MSISDN", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "edit-profile", category: "Account", contract: "same", drift: [], risk: "low", android: "name, email, phone", ios: "firstName, lastName", notes: "Verify BFF accepts both", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "update-profile-settings", category: "Account", contract: "same", drift: [], risk: "low", android: "biometric, auto-logout", ios: "ChangeSettingRequest + loyalty carousel", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "unlink-account", category: "Account", contract: "same", drift: [], risk: "low", android: "uid, accountParam, accountMode", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "add-alias / delete-alias", category: "Account", contract: "same", drift: [], risk: "low", android: "alias CRUD", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "save-third-party-alias / delete-third-party-alias", category: "Account", contract: "same", drift: ["HDR"], risk: "low", android: "body + optional lob header", ios: "same", notes: "", androidExtra: "+ HeaderMap", iosExtra: "+ lob (optional)" },
  { path: "delete-account", category: "Account", contract: "same", drift: [], risk: "low", android: "credentials + accounts", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "activate-disney-product", category: "Account", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "ActivateDisneyRequest", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "update-onguard-url", category: "Account", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "DefenderUrlRequest", ios: "\u2014", notes: "OnGuard defender URL", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "storefront/fetch-app-update", category: "Storefront", contract: "same", drift: [], risk: "low", android: "app version request", ios: "StorefrontAppUpdateRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/get-latest-version", category: "Storefront", contract: "same", drift: [], risk: "low", android: "config request", ios: "StorefrontVersionRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/get-user-configuration", category: "Storefront", contract: "same", drift: [], risk: "low", android: "config request", ios: "StorefrontUserConfigRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/get-banner-details", category: "Storefront", contract: "same", drift: [], risk: "low", android: "config request", ios: "StorefrontBannerRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/term-condition-policies", category: "Storefront", contract: "same", drift: [], risk: "low", android: "config request", ios: "StorefrontPolicyRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/registration-tnc", category: "Storefront", contract: "same", drift: [], risk: "low", android: "{}", ios: "{}", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "storefront/get-app-tutorial-details", category: "Storefront", contract: "ios-only", drift: ["ROUTE"], risk: "low", android: "\u2014", ios: "StorefrontAppTutorialDetailsRequest", notes: "Tutorial onboarding", androidExtra: "\u2014", iosExtra: "baseline" },
  { path: "cms/get-app-list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "app list filters", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/swipe-to-refresh-list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "{}", ios: "{}", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/prepaid-journey-config/list-config", category: "Storefront", contract: "same", drift: [], risk: "low", android: "search text", ios: "searchText (ACTIVE)", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/get-payment-amount-config", category: "Storefront", contract: "same", drift: [], risk: "low", android: "paging + search", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/sales-offer-menu", category: "Storefront", contract: "same", drift: [], risk: "low", android: "{ msisdn }", ios: "{ msisdn }", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/sales-catalogue/list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "plan names, account, lob", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/esim/list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "msisdn", ios: "msisdn", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/addon-configuration/list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "{}", ios: "{}", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/status-card-config/list", category: "Storefront", contract: "same", drift: [], risk: "low", android: "{}", ios: "{}", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cms/redis-data-list", category: "Storefront", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "StringManagerRequest (keys)", ios: "\u2014", notes: "Redis-backed CMS strings", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "topup / third-party/topup", category: "Payments", contract: "drift", drift: ["BODY", "TYPE", "HDR"], risk: "high", android: "MetacTopupRequest; msisdn Long required", ios: "HostedPaymentInitiationRequest; +accountNumber, serviceNumber, email", notes: "Extra iOS fields; msisdn optional on iOS", androidExtra: "+ lob", iosExtra: "+ lob" },
  { path: "initiateBillPayment / third-party/\u2026", category: "Payments", contract: "drift", drift: ["BODY"], risk: "medium", android: "bill pay initiation", ios: "hosted shape; omits msisdn/region", notes: "", androidExtra: "+ lob", iosExtra: "+ lob" },
  { path: "plan-purchase / third-party/plan-purchase", category: "Payments", contract: "same", drift: ["HDR"], risk: "low", android: "PlanPurchaseRequest + headers", ios: "PlanPurchaseInitiationRequest + lob", notes: "", androidExtra: "+ HeaderMap", iosExtra: "+ lob" },
  { path: "get-payment-method-all-gateways", category: "Payments", contract: "drift", drift: ["BODY"], risk: "medium", android: "currencyCode", ios: "uid + paymentType", notes: "Different bodies on same path", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "list-available-payment-types", category: "Payments", contract: "same", drift: [], risk: "low", android: "currencyCode", ios: "currencyCode", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "get-stored-payments", category: "Payments", contract: "drift", drift: ["BODY"], risk: "medium", android: "Map<String,String>", ios: "GetStoredPaymentsRequest (userId)", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "initiate-add-payment-method", category: "Payments", contract: "same", drift: ["HDR"], risk: "low", android: "hosted add-card", ios: "hosted + lob header", notes: "", androidExtra: "baseline", iosExtra: "+ lob" },
  { path: "delete-payment-method", category: "Payments", contract: "same", drift: [], risk: "low", android: "paymentMethodId", ios: "paymentMethodId", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "update-payment-method-alias", category: "Payments", contract: "same", drift: [], risk: "low", android: "id + alias", ios: "id + alias", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "validate-account", category: "Payments", contract: "same", drift: [], risk: "low", android: "accountId, type, lob", ios: "same", notes: "", androidExtra: "+ lob", iosExtra: "baseline" },
  { path: "voucher-topup", category: "Payments", contract: "same", drift: ["HDR"], risk: "low", android: "voucher, msisdn + lob header", ios: "voucher, msisdn", notes: "", androidExtra: "+ lob", iosExtra: "baseline" },
  { path: "plan-catalog", category: "Payments", contract: "same", drift: ["HDR"], risk: "low", android: "msisdn, zone + countryCode JM", ios: "msisdn, zone", notes: "", androidExtra: "+ countryCode", iosExtra: "baseline" },
  { path: "add-prepaid-plan", category: "Payments", contract: "same", drift: ["HDR", "TYPE"], risk: "medium", android: "msisdn, planId + lob header", ios: "msisdn Int64 + lob (lowercased)", notes: "", androidExtra: "+ lob", iosExtra: "+ lob" },
  { path: "conversion-rate", category: "Payments", contract: "drift", drift: ["HDR", "BODY"], risk: "medium", android: "from/to currency", ios: "msisdn + currencies; countryCode JM header", notes: "", androidExtra: "baseline", iosExtra: "+ countryCode" },
  { path: "transaction-detail", category: "Payments", contract: "same", drift: [], risk: "low", android: "transactionId", ios: "transactionId, userId?", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "list-recurring-payments", category: "Payments", contract: "same", drift: [], risk: "low", android: "account filter", ios: "account filter", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "initiate-recurring-enrollment", category: "Payments", contract: "same", drift: [], risk: "low", android: "enrollment fields", ios: "enrollment fields", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "update-recurring-payment", category: "Payments", contract: "same", drift: [], risk: "low", android: "id + payment method", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "cancel-recurring-payment", category: "Payments", contract: "same", drift: [], risk: "low", android: "account + recurring id", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "get-payment-history / delete-payment-history", category: "Payments", contract: "same", drift: ["HDR"], risk: "low", android: "paging + optional lob", ios: "same", notes: "", androidExtra: "+ HeaderMap (delete)", iosExtra: "+ lob (optional)" },
  { path: "get-bill-history", category: "Payments", contract: "same", drift: [], risk: "low", android: "account, date range", ios: "account, lob", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "get-prepaid-recharge-history", category: "Payments", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "recharge history request", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "payment-history", category: "Payments", contract: "same", drift: [], risk: "low", android: "account, dates", ios: "account, dates", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "download-bill-pdf", category: "Payments", contract: "same", drift: [], risk: "low", android: "invoiceId", ios: "billNumber", notes: "Verify BFF field alias", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "PA/sigma/widget-url", category: "Payments", contract: "android-only", drift: ["ROUTE"], risk: "high", android: "SigmaSessionRequest + lob", ios: "\u2014", notes: "Sigma hosted widget", androidExtra: "+ lob", iosExtra: "\u2014" },
  { path: "PA/sigma/{rebill-*}", category: "Payments", contract: "android-only", drift: ["ROUTE"], risk: "high", android: "SigmaTokenPaymentRequest + lob", ios: "\u2014", notes: "Sigma token rebill", androidExtra: "+ lob", iosExtra: "\u2014" },
  { path: "PA/esb/topupBalance", category: "Payments", contract: "android-only", drift: ["ROUTE"], risk: "high", android: "TopUpBalanceRequest + headers", ios: "\u2014", notes: "Legacy ESB top-up", androidExtra: "+ HeaderMap", iosExtra: "\u2014" },
  { path: "get-top-up-web-view-url", category: "Payments", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "WebviewRequest", ios: "\u2014", notes: "WebView checkout URL", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/user/get", category: "Loyalty", contract: "same", drift: [], risk: "low", android: "uid, email", ios: "uid, email", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "loyalty/transactional/get-history", category: "Loyalty", contract: "same", drift: [], risk: "low", android: "paginated history", ios: "paginated history", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "loyalty/giftme/merchants", category: "Loyalty", contract: "same", drift: [], risk: "low", android: "merchants list", ios: "merchants list", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "loyalty/giftme/merchant/vouchers", category: "Loyalty", contract: "same", drift: [], risk: "low", android: "merchant vouchers", ios: "merchant vouchers", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "loyalty/giftme/redeem-coupon", category: "Loyalty", contract: "same", drift: [], risk: "low", android: "redeem request", ios: "redeem request", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "loyalty/transactional/claim", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "ClaimLoyaltyPointRequest", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/tier/get", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "tier request", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/transactional/get-unclaimed", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "unclaimed list", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/point-based/vouchers/available", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "available vouchers", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/point-based/vouchers/user", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "medium", android: "redeemed vouchers", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/v1/redemption/point/report/detail", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "redemption report", ios: "\u2014", notes: "Double v1 in path", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "loyalty/help-faq/get", category: "Loyalty", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "FAQ request", ios: "\u2014", notes: "", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "communication/get-feature-type", category: "Comms", contract: "same", drift: [], risk: "low", android: "feature check", ios: "{ check }", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "communication/get-unread-push-notification-count", category: "Comms", contract: "same", drift: [], risk: "low", android: "check flag", ios: "{ check }", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "communication/get-all-push-notification", category: "Comms", contract: "same", drift: [], risk: "low", android: "paging", ios: "paging", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "communication/mark-as-read", category: "Comms", contract: "same", drift: [], risk: "low", android: "notification id", ios: "{ id }", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "communication/save-fcm-token", category: "Comms", contract: "same", drift: [], risk: "low", android: "fcm token", ios: "fcm token", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "update-account-details-audit", category: "Comms", contract: "same", drift: [], risk: "low", android: "account audit fields", ios: "fcm + daily active users", notes: "Different audit payloads", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "analytics/new-app-install", category: "Comms", contract: "same", drift: [], risk: "low", android: "event + params", ios: "createdAt date", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "analytics/create-carousal", category: "Comms", contract: "same", drift: [], risk: "low", android: "carousel report", ios: "inputList campaigns", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "campaign/get-in-app-push", category: "Comms", contract: "same", drift: [], risk: "low", android: "client/device ids", ios: "InAppRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "campaign/in-app-call-back", category: "Comms", contract: "same", drift: [], risk: "low", android: "callback action", ios: "InAppCallbackRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "campaign/cpass-callback", category: "Comms", contract: "same", drift: [], risk: "low", android: "push event", ios: "CpasscallbackRequest", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "campaign/AppEvent/event/", category: "Comms", contract: "android-only", drift: ["ROUTE"], risk: "low", android: "EventRequest", ios: "\u2014", notes: "CLM app event", androidExtra: "baseline", iosExtra: "\u2014" },
  { path: "shop-section/* (5 paths)", category: "Comms", contract: "same", drift: [], risk: "low", android: "eSIM / physical SIM orders", ios: "same", notes: "", androidExtra: "baseline", iosExtra: "baseline" },
  { path: "store-locator/locations", category: "Comms", contract: "same", drift: [], risk: "low", android: "lat/lng/radius", ios: "page/search", notes: "Pagination model differs", androidExtra: "baseline", iosExtra: "baseline" },
];

const STALE: { path: string; android: string; ios: string; notes: string }[] = [
  { path: "get-lob-details", android: "stale", ios: "absent", notes: "EndPoints constant; no Service @POST wiring" },
  { path: "PA/payment-method/delete-payment-method", android: "stale", ios: "absent", notes: "Superseded by delete-payment-method" },
  { path: "api/jamaicapaymentproxy/v1/redmond/payment-methods/delete", android: "stale", ios: "absent", notes: "Legacy Redmond delete path" },
  { path: "send-otp", android: "integrated (unused)", ios: "stale", notes: "Resend OTP uses send-otp-lambda on both platforms" },
  { path: "otp-update-and-set-link-account", android: "integrated", ios: "stale constant", notes: "iOS chains otp-update + set-account-info instead" },
  { path: "user-profile/update-user-settings", android: "absent", ios: "stale", notes: "SettingsEndPoint uses non-BFF userProfileBaseUrl; unwired" },
  { path: "NetworkConstants.URL duplicates (topup, initiateBillPayment, salesOfferMenu)", android: "absent", ios: "stale", notes: "Live iOS paths use HostedPaymentAPIPath enum" },
  { path: "SalesMenuEndPoint.fetchSalesOfferMenu", android: "absent", ios: "stale dead code", notes: "Maps to shop-section/create-esim-order; zero callers" },
];

const MODULE_ORDER: Category[] = ["Auth", "Account", "Storefront", "Payments", "Loyalty", "Comms"];

const CATEGORY_COLOR: Record<Category, Color> = {
  Auth: "blue",
  Account: "purple",
  Storefront: "cyan",
  Payments: "orange",
  Loyalty: "yellow",
  Comms: "green",
};

const CONTRACT_KIND: Record<Contract, string> = {
  same: "Same",
  drift: "Drift",
  "android-only": "Android only",
  "ios-only": "iOS only",
};

const CONTRACT_COLOR: Record<string, Color> = {
  Same: "green",
  Drift: "orange",
  "Android only": "blue",
  "iOS only": "purple",
  "A only": "blue",
};

const DRIFT_TAG_COLOR: Record<string, Color> = {
  BODY: "orange",
  HDR: "cyan",
  ROUTE: "blue",
  TYPE: "purple",
  CASE: "red",
  HOST: "pink",
};

const RISK_TONE: Record<Risk, TableRowTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

function tintHex(hue: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return hue.length === 7 ? `${hue}${a}` : hue;
}

function categoryTint(theme: ReturnType<typeof useHostTheme>, color: Color) {
  const hue = theme.category[color];
  return {
    cellBg: tintHex(hue, 0.12),
    cellBorder: tintHex(hue, 0.22),
  };
}

function TintedLabelChip({ label, kind }: { label: string; kind: string }) {
  const theme = useHostTheme();
  const color = CONTRACT_COLOR[kind] ?? "gray";
  const { cellBg, cellBorder } = categoryTint(theme, color);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "18px",
        whiteSpace: "nowrap",
        background: cellBg,
        border: `1px solid ${cellBorder}`,
        color: theme.text.primary,
      }}
    >
      {label}
    </span>
  );
}

function DriftTagChip({ tag }: { tag: string }) {
  const theme = useHostTheme();
  const color = DRIFT_TAG_COLOR[tag] ?? "gray";
  const { cellBg, cellBorder } = categoryTint(theme, color);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "16px",
        background: cellBg,
        border: `1px solid ${cellBorder}`,
        color: theme.text.primary,
      }}
    >
      {tag}
    </span>
  );
}

function DriftTags({ tags }: { tags: string[] }) {
  if (!tags.length) return <Text tone="quaternary" size="small">—</Text>;
  return (
    <Row gap={4} wrap>
      {tags.map((t) => (
        <DriftTagChip key={t} tag={t} />
      ))}
    </Row>
  );
}

function PlainChip({ label, color = "gray" as Color }: { label: string; color?: Color }) {
  const theme = useHostTheme();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "18px",
        whiteSpace: "nowrap",
        border: `1px solid ${theme.stroke.secondary}`,
        background: theme.fill.tertiary,
        color: theme.text.primary,
      }}
    >
      {label}
    </span>
  );
}

function ExtraCell({ value }: { value: string }) {
  if (value === "baseline") {
    return <Text size="small" tone="secondary" style={{ fontStyle: "italic" }}>baseline</Text>;
  }
  return <Text size="small" tone="secondary">{value}</Text>;
}

function CodeInline({ children }: { children: unknown }) {
  const theme = useHostTheme();
  return (
    <code
      style={{
        fontFamily: theme.typography.fontFamily,
        fontSize: "0.92em",
        padding: "1px 5px",
        borderRadius: 4,
        background: theme.fill.tertiary,
        color: theme.text.primary,
      }}
    >
      {children}
    </code>
  );
}

function summarizeModule(items: ApiRow[]) {
  const same = items.filter((r) => r.contract === "same").length;
  const drift = items.filter((r) => r.contract === "drift").length;
  const hdr = items.filter((r) => r.drift.includes("HDR")).length;
  const exclusive = items.filter((r) => r.contract === "android-only" || r.contract === "ios-only").length;
  const totalDiff = items.filter((r) => r.contract !== "same" || r.drift.includes("HDR")).length;
  return { apis: items.length, same, drift, hdr, exclusive, totalDiff };
}

function StatusDot({ tone }: { tone: "warning" | "info" }) {
  const theme = useHostTheme();
  const fill = tone === "warning" ? theme.category.orange : theme.category.cyan;
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: fill,
        flexShrink: 0,
      }}
    />
  );
}

function ModuleCell({ name, drift }: { name: Category; drift: number }) {
  return (
    <Row gap={8} align="center">
      <Swatch color={CATEGORY_COLOR[name]} />
      <StatusDot tone={drift > 0 ? "warning" : "info"} />
      <Text weight="semibold">{name}</Text>
    </Row>
  );
}

function DashOrValue({ value }: { value: number }) {
  if (value === 0) return <Text tone="quaternary" size="small">—</Text>;
  return value;
}

function CountBubble({ value }: { value: number }) {
  return <PlainChip label={String(value)} />;
}

function pct(count: number, total: number): string {
  return total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
}

function moduleSummary(rows: ApiRow[]) {
  const map = new Map<Category, ReturnType<typeof summarizeModule>>();
  for (const mod of MODULE_ORDER) {
    map.set(mod, summarizeModule(rows.filter((r) => r.category === mod)));
  }
  return map;
}

export default function SuperappJamaicaApiDrift() {
  const modStats = useMemo(() => moduleSummary(APIS), []);

  const moduleHdrTotal = useMemo(
    () => MODULE_ORDER.reduce((sum, mod) => sum + modStats.get(mod)!.hdr, 0),
    [modStats],
  );
  const moduleDiffTotal = useMemo(
    () => MODULE_ORDER.reduce((sum, mod) => sum + modStats.get(mod)!.totalDiff, 0),
    [modStats],
  );

  const baselineSummary = useMemo(() => {
    const same = BASELINE_HEADERS.filter((h) => h.status === "Same").length;
    const drift = BASELINE_HEADERS.filter((h) => h.status === "Drift").length;
    const aOnly = BASELINE_HEADERS.filter((h) => h.status === "A only").length;
    const iosOnly = BASELINE_HEADERS.filter((h) => h.status === "iOS only").length;
    return { same, drift, aOnly, iosOnly, total: BASELINE_HEADERS.length, totalDiff: drift + aOnly + iosOnly };
  }, []);

  const barCategories = MODULE_ORDER;
  const barSeries = [
    { name: "HDR", data: MODULE_ORDER.map((mod) => modStats.get(mod)!.hdr), tone: "info" as const },
    { name: "Contract drift", data: MODULE_ORDER.map((mod) => modStats.get(mod)!.drift), tone: "warning" as const },
    { name: "Route exclusive", data: MODULE_ORDER.map((mod) => modStats.get(mod)!.exclusive), tone: "neutral" as const },
  ];

  return (
    <Stack gap={20} style={{ padding: "4px 2px 24px", maxWidth: 1200 }}>
      <Stack gap={6}>
        <H1>Superapp Jamaica — API Contract Drift</H1>
        <Text tone="secondary">
          Sprint <CodeInline>{META.sprint}</CodeInline> · Android <CodeInline>{META.androidSha}</CodeInline> · iOS{" "}
          <CodeInline>{META.iosSha}</CodeInline> · Generated {META.generated}
        </Text>
        <Row gap={8} wrap>
          <PlainChip label={`BFF ${META.bffPrefix}`} color="blue" />
          <PlainChip label="POST JSON" />
          <PlainChip label={`Hosts ${META.hostMatch}`} color="green" />
          <PlainChip label={`Tenant ${META.tenantId}`} color="purple" />
        </Row>
      </Stack>

      <CollapsibleSection title="How to read this report" trailing="Contract · Drift tags" defaultOpen={false}>
        <Stack gap={12}>
          <Text size="small" tone="secondary">
            <Text weight="semibold">Contract</Text> — cross-platform alignment per BFF path.{" "}
            <Text weight="semibold">Drift</Text> — mismatch type when wired on both.{" "}
            <Text weight="semibold">Android extra / iOS extra</Text> — per-call headers beyond interceptor baseline.
          </Text>
          <Table
            headers={["Contract value", "Meaning"]}
            rows={[
              [<TintedLabelChip label="Same" kind="Same" />, "Wired on both; request contract matches"],
              [<TintedLabelChip label="Drift" kind="Drift" />, "Wired on both; body, headers, types, or orchestration differ"],
              [<TintedLabelChip label="Android only" kind="Android only" />, "Wired on Android, absent on iOS"],
              [<TintedLabelChip label="iOS only" kind="iOS only" />, "Wired on iOS, absent on Android"],
            ]}
          />
          <Table
            headers={["Drift tag", "Meaning"]}
            rows={[
              [<DriftTagChip tag="BODY" />, "Request body field mismatch"],
              [<DriftTagChip tag="HDR" />, "Per-call or baseline header mismatch"],
              [<DriftTagChip tag="ROUTE" />, "Path wired on one platform only"],
              [<DriftTagChip tag="TYPE" />, "Type / enum mismatch on shared path"],
              [<DriftTagChip tag="CASE" />, "Header name casing mismatch (e.g. uid vs UID)"],
              [<DriftTagChip tag="HOST" />, "Different base URL / host"],
            ]}
          />
          <Text size="small" tone="tertiary">Row dot colors reflect severity (high-risk rows use danger tone).</Text>
        </Stack>
      </CollapsibleSection>

      <Grid columns={6} gap={12}>
        <Stat value={KPIS.total} label="APIs audited" />
        <Stat value={KPIS.same} label="Contract match" tone="success" />
        <Stat value={KPIS.drift} label="Drift" tone="warning" />
        <Stat value={20} label="Platform exclusive" tone="info" />
        <Stat value={KPIS.highRisk} label="High risk" tone="danger" />
        <Stat value={KPIS.stale} label="Stale constants" />
      </Grid>

      <Divider />

      <Stack gap={8}>
        <Row gap={16} align="center" wrap>
          <H3>Header & contract diff by module</H3>
          <Stat value={moduleHdrTotal} label="Endpoint HDR drifts" />
          <Stat value={moduleDiffTotal} label="Total module diffs" />
        </Row>
        <Grid columns="1fr 1.2fr" gap={16}>
          <Stack gap={6}>
            <BarChart
              height={240}
              categories={barCategories}
              series={barSeries}
              horizontal
            />
            <Text size="small" tone="tertiary">Module drift breakdown · API count by module · Source: sprint SHA inventory</Text>
          </Stack>
          <Table
            headers={["Module", "APIs", "Same", "Drift", "HDR", "Exclusive", "Total diff"]}
            striped
            rows={MODULE_ORDER.map((mod) => {
              const s = modStats.get(mod)!;
              return [
                <ModuleCell name={mod} drift={s.drift} />,
                s.apis,
                s.same,
                <DashOrValue value={s.drift} />,
                s.hdr === 0 ? <DashOrValue value={0} /> : <CountBubble value={s.hdr} />,
                s.exclusive,
                <CountBubble value={s.totalDiff} />,
              ];
            })}
          />
        </Grid>
      </Stack>

      <Grid columns={2} gap={16}>
        <Stack gap={8}>
          <H3>Contract status</H3>
          <Row gap={8} wrap>
            <PlainChip label={`Same · ${KPIS.same} · ${pct(KPIS.same, KPIS.total)}%`} color="green" />
            <PlainChip label={`Drift · ${KPIS.drift} · ${pct(KPIS.drift, KPIS.total)}%`} color="orange" />
            <PlainChip label={`Android only · ${KPIS.androidOnly} · ${pct(KPIS.androidOnly, KPIS.total)}%`} color="blue" />
            <PlainChip label={`iOS only · ${KPIS.iosOnly} · ${pct(KPIS.iosOnly, KPIS.total)}%`} color="purple" />
            <PlainChip label={`${KPIS.total} paths`} />
          </Row>
          <Text size="small" tone="tertiary">Source: sprint SHA inventory · contract field per API path</Text>
        </Stack>
        <Stack gap={8}>
          <H3>Route coverage</H3>
          <UsageBar
            total={KPIS.total}
            segments={[
              { id: "same", value: KPIS.same, color: "green" },
              { id: "drift", value: KPIS.drift, color: "orange" },
              { id: "android-only", value: KPIS.androidOnly, color: "blue" },
              { id: "ios-only", value: KPIS.iosOnly, color: "purple" },
            ]}
          />
          <Text size="small" tone="tertiary">Wired on both platforms: 77 paths at this SHA</Text>
        </Stack>
      </Grid>

      <Divider />

      <Stack gap={8}>
        <Row gap={12} align="center" wrap>
          <H3>High-risk findings</H3>
          <PlainChip label="6 items" color="red" />
        </Row>
        <Text size="small" tone="secondary">Paths and baseline headers requiring immediate cross-platform review.</Text>
        <Table
          headers={["Path", "Contract", "What to check", "Drift"]}
          striped
          rowTone={["danger", "danger", "danger", "danger", "danger", "danger"]}
          rows={[
      [
        <CodeInline>otp-update-and-set-link-account</CodeInline>,
        <TintedLabelChip label="Drift" kind="Drift" />,
        "Different orchestration — Android single call vs iOS chains otp-update + set-account-info",
        <DriftTags tags={["ROUTE", "BODY"]} />,
      ],
      [
        <CodeInline>topup / third-party/topup</CodeInline>,
        <TintedLabelChip label="Drift" kind="Drift" />,
        "Body/type drift — Android msisdn Long required; iOS HostedPaymentInitiationRequest with extra fields",
        <DriftTags tags={["BODY", "TYPE", "HDR"]} />,
      ],
      [
        <CodeInline>PA/sigma/widget-url</CodeInline>,
        <TintedLabelChip label="Android only" kind="Android only" />,
        "Android-only Sigma hosted payment path — no iOS wiring",
        <DriftTags tags={["ROUTE"]} />,
      ],
      [
        <CodeInline>PA/sigma/{"{rebill-*}"}</CodeInline>,
        <TintedLabelChip label="Android only" kind="Android only" />,
        "Android-only Sigma token rebill — no iOS wiring",
        <DriftTags tags={["ROUTE"]} />,
      ],
      [
        <CodeInline>PA/esb/topupBalance</CodeInline>,
        <TintedLabelChip label="Android only" kind="Android only" />,
        "Android-only legacy ESB top-up — no iOS wiring",
        <DriftTags tags={["ROUTE"]} />,
      ],      [
        <CodeInline>uid / UID (baseline)</CodeInline>,
        <TintedLabelChip label="Drift" kind="Drift" />,
        "Android sends lowercase uid; iOS sends UID. Confirm BFF normalizes casing on every authenticated call.",
        <DriftTags tags={["CASE", "HDR"]} />,
      ],
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <CollapsibleSection
          title="Baseline header"
          count={baselineSummary.total}
          leading={<Swatch color="gray" />}
          defaultOpen
        >
          <Stack gap={10}>
            <Row gap={8} wrap>
              <PlainChip label={`Same ${baselineSummary.same}`} />
              <PlainChip label={`Drift ${baselineSummary.drift}`} />
              <PlainChip label={`Android only ${baselineSummary.aOnly}`} />
              <PlainChip label={`iOS only ${baselineSummary.iosOnly}`} />
            </Row>
            <Table
              headers={["Header", "Android", "iOS", "Status", "Tag"]}
              striped
              rows={BASELINE_HEADERS.map((h) => [
                <CodeInline>{h.header}</CodeInline>,
                <Text size="small" tone="secondary">{h.android}</Text>,
                <Text size="small" tone="secondary">{h.ios}</Text>,
                <TintedLabelChip label={h.status} kind={h.status} />,
                h.tag === "—" ? <Text tone="quaternary" size="small">—</Text> : <DriftTags tags={[h.tag]} />,
              ])}
            />
            <Text size="small" tone="tertiary">
              Android: {META.androidBaselineEvidence} · iOS: {META.iosBaselineEvidence}
            </Text>
            <Row gap={8} wrap>
              <PlainChip label={`Diff ${baselineSummary.totalDiff}`} />
              <PlainChip label={`Drift ${baselineSummary.drift}`} />
              <PlainChip label={`Platform-only ${baselineSummary.aOnly + baselineSummary.iosOnly}`} />
            </Row>
          </Stack>
        </CollapsibleSection>

        {MODULE_ORDER.map((cat) => {
          const rows = APIS.filter((r) => r.category === cat);
          const s = modStats.get(cat)!;
          return (
            <CollapsibleSection
              key={cat}
              title={cat}
              count={rows.length}
              leading={<Swatch color={CATEGORY_COLOR[cat]} />}
              trailing={
                <Row gap={6} wrap>
                  {s.hdr > 0 ? <PlainChip label={`HDR ${s.hdr}`} /> : null}
                  {s.drift > 0 ? <PlainChip label={`Drift ${s.drift}`} /> : null}
                  {s.exclusive > 0 ? <PlainChip label={`Exclusive ${s.exclusive}`} /> : null}
                </Row>
              }
            >
              <Table
                headers={["Path", "Contract", "Drift", "Android extra", "iOS extra", "Android body", "iOS body", "Notes"]}
                striped
                stickyHeader
                rowTone={rows.map((r) => RISK_TONE[r.risk])}
                rows={rows.map((r) => [
                  <CodeInline>{r.path}</CodeInline>,
                  <TintedLabelChip label={CONTRACT_KIND[r.contract]} kind={CONTRACT_KIND[r.contract]} />,
                  <DriftTags tags={r.drift} />,
                  <ExtraCell value={r.androidExtra} />,
                  <ExtraCell value={r.iosExtra} />,
                  <Text size="small" tone="secondary">{r.android}</Text>,
                  <Text size="small" tone="secondary">{r.ios}</Text>,
                  <Text size="small">{r.notes || "—"}</Text>,
                ])}
              />
            </CollapsibleSection>
          );
        })}
      </Stack>

      <CollapsibleSection title="Stale constants" count={STALE.length} leading={<Swatch color="gray" />}>
        <Table
          headers={["Path", "Android", "iOS", "Notes"]}
          striped
          rows={STALE.map((s) => [
            <CodeInline>{s.path}</CodeInline>,
            s.android,
            s.ios,
            <Text size="small" tone="secondary">{s.notes || "—"}</Text>,
          ])}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Environment base URLs" leading={<Swatch color="blue" />} defaultOpen={false}>
        <Table
          headers={["Env", "Android", "iOS", "Match"]}
          rows={[
            ["Dev", `dev.${META.host}`, `dev.${META.host}`, "same"],
            ["Staging", `stg.${META.host}`, `stg.${META.host}`, "same"],
            ["Pre-prod", `pre-prod.${META.host}`, `pre-prod.${META.host}`, "same"],
            ["Prod", META.host, META.host, "same"],
          ]}
        />
      </CollapsibleSection>

      <Text size="small" tone="tertiary">
        Generated by API contract drift workflow · docs/10-api-contract-drift.md · SHAs {META.androidSha} / {META.iosSha}
      </Text>
    </Stack>
  );
}
