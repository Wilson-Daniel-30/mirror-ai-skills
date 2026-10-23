> **Interactive report:** open `superapp-jamaica-api-contract-drift.canvas.tsx` in Cursor (canvases folder) — same `superapp-jamaica-api-contract-drift` as this markdown file basename.
> This file includes the full API inventory and baseline header tables (same data as the canvas).

# Superapp Caribbean — Jamaica (JM) — API contract drift

| | |
|---|---|
| **Generated** | 2026-10-07 |
| **Market** | Superapp Caribbean — Jamaica (JM) |
| **Sprint branch** | `Jamaica/feature/development` |
| **Android** | `lla-superapp-android` @ `0b03ae1f` |
| **iOS** | `lla-superapp-ios` @ `3124b4e0` |
| **BFF prefix** | `/api/metac-app-bff/v1/` |
| **Method** | POST JSON |
| **Hosts** | same — `superapp.core.metac.libertyuconnect.com` on both |
| **Tenant** | JM |
| **Source** | `superapp-workspace` @ `feature/api-contract-drift-v2` (`11619e0`) |

## KPIs

| Metric | Count |
|--------|------:|
| APIs audited | 97 |
| Contract match | 70 |
| Drift | 7 |
| Platform exclusive | 20 |
| High risk | 5 |
| Stale constants | 8 |

## Contract status

| Status | Count | % |
|--------|------:|--:|
| Same | 70 | 72.2 |
| Drift | 7 | 7.2 |
| Android only | 18 | 18.6 |
| iOS only | 2 | 2.1 |

**Total paths:** 97 · **Wired on both:** 77

## How to read

| Column | Meaning |
|--------|---------|
| **Contract** | Cross-platform alignment per path: **Same** · **Drift** · **Android only** · **iOS only** |
| **Drift** | Mismatch type when shared: `BODY` · `HDR` · `ROUTE` · `TYPE` · `CASE` · `HOST` |
| **Android extra / iOS extra** | Per-call headers beyond interceptor baseline — *baseline* when none; `+ lob`, `+ countryCode`, uid casing notes |

## Module summary

| Module | APIs | Same | Drift | HDR | Exclusive | Total diff |
|--------|-----:|-----:|------:|----:|----------:|-----------:|
| Auth | 16 | 12 | 1 | — | 3 | 4 |
| Account | 10 | 7 | 1 | 1 | 2 | 4 |
| Storefront | 17 | 15 | — | — | 2 | 2 |
| Payments | 28 | 18 | 5 | 8 | 5 | 16 |
| Loyalty | 12 | 5 | — | — | 7 | 7 |
| Comms | 14 | 13 | — | — | 1 | 1 |

## High-risk findings

| Path | Contract | What to check | Drift |
|------|----------|---------------|-------|
| `otp-update-and-set-link-account` | **Drift** | Different orchestration — Android single call vs iOS chains otp-update + set-account-info | `ROUTE`, `BODY` |
| `topup / third-party/topup` | **Drift** | Body/type drift — Android msisdn Long required; iOS HostedPaymentInitiationRequest with extra fields | `BODY`, `TYPE`, `HDR` |
| `PA/sigma/widget-url` | **Android only** | Android-only Sigma hosted payment path — no iOS wiring | `ROUTE` |
| `PA/sigma/{rebill-*}` | **Android only** | Android-only Sigma token rebill — no iOS wiring | `ROUTE` |
| `PA/esb/topupBalance` | **Android only** | Android-only legacy ESB top-up — no iOS wiring | `ROUTE` |
| `uid / UID (baseline)` | **Drift** | Android sends lowercase uid; iOS sends UID. Confirm BFF normalizes casing on every authenticated call. | `CASE`, `HDR` |

## Baseline headers (interceptors)

| | Count |
|---|------:|
| Headers audited | 30 |
| Same | 13 |
| Drift | 17 |
| Android only | 0 |
| iOS only | 0 |
| **Total diffs** | 17 |

**Full baseline table** (interceptors @ sprint SHA):

| Header | Android | iOS | Status | Tag |
|--------|---------|-----|--------|-----|
| `Authorization` | Bearer accessToken (refresh token on auth/refresh-token) | Bearer accessToken (refresh fallback if access empty) | Same | — |
| `uid` | uid (lowercase header name) | UID (uppercase header name) | Drift | `CASE` |
| `Content-Type` | application/json | application/json | Same | — |
| `Accept` | application/json | `*/*` | Drift | `HDR` |
| `appLanguage` | "es" hardcoded (HeaderInterceptor.kt:44) | Locale.current languageCode (default en) | Drift | `HDR` |
| `tenantId` | JM (BuildConfig.TENANT_ID) | JM (TenantConfig.current.rawValue) | Same | — |
| `appName` | Flow + (BuildConfig.APP_NAME) | My Flow Self Care (HeaderValue.appNameDefault) | Drift | `HDR` |
| `appVersion` | BuildConfig.VERSION_NAME | Bundle.main.marketingVersionString | Same | — |
| `appVersionCode` | BuildConfig.VERSION_CODE | Bundle.main.buildVersionNumber | Same | — |
| `channel` | APP | APP | Same | — |
| `deviceId` | prefHelper.getDeviceId() | identifierForVendor UUID | Same | — |
| `deviceType` | android | iOS | Same | — |
| `deviceName` | ${MANUFACTURER} ${MODEL} | UIDevice.current.name | Same | — |
| `OSNAME` | Android | iOS (Header.osName) | Same | — |
| `OSVERSION` | Build.VERSION.RELEASE | UIDevice.current.systemVersion | Same | — |
| `OSMODELNAME` | Build.VERSION_CODES field name | — (not sent) | Drift | `HDR` |
| `OSPRODUCTNAME` | Build.PRODUCT | — (not sent) | Drift | `HDR` |
| `OSFIRMWAREBUILD` | Build.DISPLAY | — (not sent) | Drift | `HDR` |
| `reqId` | generateRandomNumber() | — (not sent) | Drift | `HDR` |
| `mmReqIdentifier` | SecurityInterceptor only | random Int64 in standardHeaders | Drift | `HDR` |
| `sessionId` | prefHelper.getSessionId() | UserDefaultsManager.shared.sessionId | Same | — |
| `uniqueId` | prefHelper.getUniqueId() | — (not sent) | Drift | `HDR` |
| `digitalKey` | SecurityInterceptor RSA wrap (PreProd+Prod) | HTTPHeaders.standardHeaders RSA wrap | Same | — |
| `Strict-Transport-Security` | max-age=63072000; includeSubDomains; preload | — (not sent) | Drift | `HDR` |
| `Accept-Encoding` | identity | — (URLSession default) | Drift | `HDR` |
| `transactionId` | optional (NotificationCache) | — | Drift | `HDR` |
| `intent` | optional (NotificationCache) | — | Drift | `HDR` |
| `campaignId` | optional (NotificationCache) | — | Drift | `HDR` |
| `conversionType` | optional (NotificationCache) | — | Drift | `HDR` |
| `Dynatrace tag` | DynatraceInterceptor | — | Drift | `HDR` |

Source: Android `core/network/src/main/java/com/core/network/intercepter/HeaderInterceptor.kt @ 0b03ae1f` · iOS `LLA-SuperApp-iOS/Core/Networking/Config/HTTPHeaders.swift @ 3124b4e0`

## API inventory by module

All paths at pinned SHA. Columns: **Path · Contract · Drift · Android extra · iOS extra · Android body · iOS body · Notes**

### Auth

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `login` | **Same** | — | *baseline* | *baseline* | loginId, password, loginMode, biometric | same fields | — |
| `otp-login` | **Same** | — | *baseline* | *baseline* | code, phone, flow, biometric | code, loginId, vtoken, biometric | — |
| `auth/refresh-token` | **Same** | — | *baseline* | *baseline* | {} | EmptyRequest | Refresh token in Authorization |
| `auth/logout` | **Same** | — | *baseline* | *baseline* | {} | {} | — |
| `registration/account-search-send-otp` | **Same** | — | *baseline* | *baseline* | phone/email search | same shape | — |
| `send-otp-lambda` | **Same** | — | *baseline* | *baseline* | phone, hash, accion, sms | same | — |
| `registration/register-and-login` | **Same** | — | *baseline* | *baseline* | code, loginId, mode, vtoken | same | — |
| `registration/set-account-info` | **Same** | — | *baseline* | *baseline* | password or link-mobile | password or mode: link-account-mobile | iOS reuses for mobile link |
| `recover-password/*` | **Same** | — | *baseline* | *baseline* | standard recover flow | same | 3 paths |
| `registration/get-account-info` | **Same** | — | *baseline* | *baseline* | uid in body | GetAccountInfoRequest(uid) | — |
| `link-account-fixed` | **Same** | — | *baseline* | *baseline* | residential link fields | same | — |
| `link-account-mobile` | **Android only** | `ROUTE` | *baseline* | — | LinkAccountMobileRequest | — | iOS uses set-account-info with mode instead |
| `otp-update-and-set-link-account` | **Drift** | `ROUTE`, `BODY` | *baseline* | *baseline* | single combined request | chains otp-update + set-account-info | Different orchestration for same journey |
| `otp-update` | **Same** | — | *baseline* | `(UID header + body uid)` | OTP verify | code, vtoken | — |
| `send-otp` | **iOS only** | `ROUTE` | *baseline* | — | integrated (unused) | stale constant | Resend uses send-otp-lambda |
| `auth/integrity-check` | **Android only** | `ROUTE` | *baseline* | — | IntegrityCheckRequest | — | Play Integrity; no iOS wiring |

### Account

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `get-home-screen-data` | **Same** | — | *baseline* | *baseline* | accountNumbers: [String] | accountNumbers: [String] | — |
| `get-account-data-details` | **Drift** | `TYPE`, `BODY` | *baseline* | *baseline* | accountNumber, msisdn, lob, serviceType (enum) | same fields; serviceType String; E.164 MSISDN | — |
| `edit-profile` | **Same** | — | *baseline* | *baseline* | name, email, phone | firstName, lastName | Verify BFF accepts both |
| `update-profile-settings` | **Same** | — | *baseline* | *baseline* | biometric, auto-logout | ChangeSettingRequest + loyalty carousel | — |
| `unlink-account` | **Same** | — | *baseline* | *baseline* | uid, accountParam, accountMode | same | — |
| `add-alias / delete-alias` | **Same** | — | *baseline* | *baseline* | alias CRUD | same | — |
| `save-third-party-alias / delete-third-party-alias` | **Same** | `HDR` | `+ HeaderMap` | `+ lob (optional)` | body + optional lob header | same | — |
| `delete-account` | **Same** | — | *baseline* | *baseline* | credentials + accounts | same | — |
| `activate-disney-product` | **Android only** | `ROUTE` | *baseline* | — | ActivateDisneyRequest | — | — |
| `update-onguard-url` | **Android only** | `ROUTE` | *baseline* | — | DefenderUrlRequest | — | OnGuard defender URL |

### Storefront

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `storefront/fetch-app-update` | **Same** | — | *baseline* | *baseline* | app version request | StorefrontAppUpdateRequest | — |
| `storefront/get-latest-version` | **Same** | — | *baseline* | *baseline* | config request | StorefrontVersionRequest | — |
| `storefront/get-user-configuration` | **Same** | — | *baseline* | *baseline* | config request | StorefrontUserConfigRequest | — |
| `storefront/get-banner-details` | **Same** | — | *baseline* | *baseline* | config request | StorefrontBannerRequest | — |
| `storefront/term-condition-policies` | **Same** | — | *baseline* | *baseline* | config request | StorefrontPolicyRequest | — |
| `storefront/registration-tnc` | **Same** | — | *baseline* | *baseline* | {} | {} | — |
| `storefront/get-app-tutorial-details` | **iOS only** | `ROUTE` | — | *baseline* | — | StorefrontAppTutorialDetailsRequest | Tutorial onboarding |
| `cms/get-app-list` | **Same** | — | *baseline* | *baseline* | app list filters | same | — |
| `cms/swipe-to-refresh-list` | **Same** | — | *baseline* | *baseline* | {} | {} | — |
| `cms/prepaid-journey-config/list-config` | **Same** | — | *baseline* | *baseline* | search text | searchText (ACTIVE) | — |
| `cms/get-payment-amount-config` | **Same** | — | *baseline* | *baseline* | paging + search | same | — |
| `cms/sales-offer-menu` | **Same** | — | *baseline* | *baseline* | { msisdn } | { msisdn } | — |
| `cms/sales-catalogue/list` | **Same** | — | *baseline* | *baseline* | plan names, account, lob | same | — |
| `cms/esim/list` | **Same** | — | *baseline* | *baseline* | msisdn | msisdn | — |
| `cms/addon-configuration/list` | **Same** | — | *baseline* | *baseline* | {} | {} | — |
| `cms/status-card-config/list` | **Same** | — | *baseline* | *baseline* | {} | {} | — |
| `cms/redis-data-list` | **Android only** | `ROUTE` | *baseline* | — | StringManagerRequest (keys) | — | Redis-backed CMS strings |

### Payments

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `topup / third-party/topup` | **Drift** | `BODY`, `TYPE`, `HDR` | `+ lob` | `+ lob` | MetacTopupRequest; msisdn Long required | HostedPaymentInitiationRequest; +accountNumber, serviceNumber, email | Extra iOS fields; msisdn optional on iOS |
| `initiateBillPayment / third-party/…` | **Drift** | `BODY` | `+ lob` | `+ lob` | bill pay initiation | hosted shape; omits msisdn/region | — |
| `plan-purchase / third-party/plan-purchase` | **Same** | `HDR` | `+ HeaderMap` | `+ lob` | PlanPurchaseRequest + headers | PlanPurchaseInitiationRequest + lob | — |
| `get-payment-method-all-gateways` | **Drift** | `BODY` | *baseline* | *baseline* | currencyCode | uid + paymentType | Different bodies on same path |
| `list-available-payment-types` | **Same** | — | *baseline* | *baseline* | currencyCode | currencyCode | — |
| `get-stored-payments` | **Drift** | `BODY` | *baseline* | *baseline* | Map<String,String> | GetStoredPaymentsRequest (userId) | — |
| `initiate-add-payment-method` | **Same** | `HDR` | *baseline* | `+ lob` | hosted add-card | hosted + lob header | — |
| `delete-payment-method` | **Same** | — | *baseline* | *baseline* | paymentMethodId | paymentMethodId | — |
| `update-payment-method-alias` | **Same** | — | *baseline* | *baseline* | id + alias | id + alias | — |
| `validate-account` | **Same** | — | `+ lob` | *baseline* | accountId, type, lob | same | — |
| `voucher-topup` | **Same** | `HDR` | `+ lob` | *baseline* | voucher, msisdn + lob header | voucher, msisdn | — |
| `plan-catalog` | **Same** | `HDR` | `+ countryCode` | *baseline* | msisdn, zone + countryCode JM | msisdn, zone | — |
| `add-prepaid-plan` | **Same** | `HDR`, `TYPE` | `+ lob` | `+ lob` | msisdn, planId + lob header | msisdn Int64 + lob (lowercased) | — |
| `conversion-rate` | **Drift** | `HDR`, `BODY` | *baseline* | `+ countryCode` | from/to currency | msisdn + currencies; countryCode JM header | — |
| `transaction-detail` | **Same** | — | *baseline* | *baseline* | transactionId | transactionId, userId? | — |
| `list-recurring-payments` | **Same** | — | *baseline* | *baseline* | account filter | account filter | — |
| `initiate-recurring-enrollment` | **Same** | — | *baseline* | *baseline* | enrollment fields | enrollment fields | — |
| `update-recurring-payment` | **Same** | — | *baseline* | *baseline* | id + payment method | same | — |
| `cancel-recurring-payment` | **Same** | — | *baseline* | *baseline* | account + recurring id | same | — |
| `get-payment-history / delete-payment-history` | **Same** | `HDR` | `+ HeaderMap (delete)` | `+ lob (optional)` | paging + optional lob | same | — |
| `get-bill-history` | **Same** | — | *baseline* | *baseline* | account, date range | account, lob | — |
| `get-prepaid-recharge-history` | **Android only** | `ROUTE` | *baseline* | — | recharge history request | — | — |
| `payment-history` | **Same** | — | *baseline* | *baseline* | account, dates | account, dates | — |
| `download-bill-pdf` | **Same** | — | *baseline* | *baseline* | invoiceId | billNumber | Verify BFF field alias |
| `PA/sigma/widget-url` | **Android only** | `ROUTE` | `+ lob` | — | SigmaSessionRequest + lob | — | Sigma hosted widget |
| `PA/sigma/{rebill-*}` | **Android only** | `ROUTE` | `+ lob` | — | SigmaTokenPaymentRequest + lob | — | Sigma token rebill |
| `PA/esb/topupBalance` | **Android only** | `ROUTE` | `+ HeaderMap` | — | TopUpBalanceRequest + headers | — | Legacy ESB top-up |
| `get-top-up-web-view-url` | **Android only** | `ROUTE` | *baseline* | — | WebviewRequest | — | WebView checkout URL |

### Loyalty

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `loyalty/user/get` | **Same** | — | *baseline* | *baseline* | uid, email | uid, email | — |
| `loyalty/transactional/get-history` | **Same** | — | *baseline* | *baseline* | paginated history | paginated history | — |
| `loyalty/giftme/merchants` | **Same** | — | *baseline* | *baseline* | merchants list | merchants list | — |
| `loyalty/giftme/merchant/vouchers` | **Same** | — | *baseline* | *baseline* | merchant vouchers | merchant vouchers | — |
| `loyalty/giftme/redeem-coupon` | **Same** | — | *baseline* | *baseline* | redeem request | redeem request | — |
| `loyalty/transactional/claim` | **Android only** | `ROUTE` | *baseline* | — | ClaimLoyaltyPointRequest | — | — |
| `loyalty/tier/get` | **Android only** | `ROUTE` | *baseline* | — | tier request | — | — |
| `loyalty/transactional/get-unclaimed` | **Android only** | `ROUTE` | *baseline* | — | unclaimed list | — | — |
| `loyalty/point-based/vouchers/available` | **Android only** | `ROUTE` | *baseline* | — | available vouchers | — | — |
| `loyalty/point-based/vouchers/user` | **Android only** | `ROUTE` | *baseline* | — | redeemed vouchers | — | — |
| `loyalty/v1/redemption/point/report/detail` | **Android only** | `ROUTE` | *baseline* | — | redemption report | — | Double v1 in path |
| `loyalty/help-faq/get` | **Android only** | `ROUTE` | *baseline* | — | FAQ request | — | — |

### Comms

| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |
|------|----------|-------|---------------|-----------|--------------|----------|-------|
| `communication/get-feature-type` | **Same** | — | *baseline* | *baseline* | feature check | { check } | — |
| `communication/get-unread-push-notification-count` | **Same** | — | *baseline* | *baseline* | check flag | { check } | — |
| `communication/get-all-push-notification` | **Same** | — | *baseline* | *baseline* | paging | paging | — |
| `communication/mark-as-read` | **Same** | — | *baseline* | *baseline* | notification id | { id } | — |
| `communication/save-fcm-token` | **Same** | — | *baseline* | *baseline* | fcm token | fcm token | — |
| `update-account-details-audit` | **Same** | — | *baseline* | *baseline* | account audit fields | fcm + daily active users | Different audit payloads |
| `analytics/new-app-install` | **Same** | — | *baseline* | *baseline* | event + params | createdAt date | — |
| `analytics/create-carousal` | **Same** | — | *baseline* | *baseline* | carousel report | inputList campaigns | — |
| `campaign/get-in-app-push` | **Same** | — | *baseline* | *baseline* | client/device ids | InAppRequest | — |
| `campaign/in-app-call-back` | **Same** | — | *baseline* | *baseline* | callback action | InAppCallbackRequest | — |
| `campaign/cpass-callback` | **Same** | — | *baseline* | *baseline* | push event | CpasscallbackRequest | — |
| `campaign/AppEvent/event/` | **Android only** | `ROUTE` | *baseline* | — | EventRequest | — | CLM app event |
| `shop-section/* (5 paths)` | **Same** | — | *baseline* | *baseline* | eSIM / physical SIM orders | same | — |
| `store-locator/locations` | **Same** | — | *baseline* | *baseline* | lat/lng/radius | page/search | Pagination model differs |

## Stale constants

| Path | Android | iOS | Notes |
|------|---------|-----|-------|
| `get-lob-details` | stale | absent | EndPoints constant; no Service @POST wiring |
| `PA/payment-method/delete-payment-method` | stale | absent | Superseded by delete-payment-method |
| `api/jamaicapaymentproxy/v1/redmond/payment-methods/delete` | stale | absent | Legacy Redmond delete path |
| `send-otp` | integrated (unused) | stale | Resend OTP uses send-otp-lambda on both platforms |
| `otp-update-and-set-link-account` | integrated | stale constant | iOS chains otp-update + set-account-info instead |
| `user-profile/update-user-settings` | absent | stale | SettingsEndPoint uses non-BFF userProfileBaseUrl; unwired |
| `NetworkConstants.URL duplicates (topup, initiateBillPayment, salesOfferMenu)` | absent | stale | Live iOS paths use HostedPaymentAPIPath enum |
| `SalesMenuEndPoint.fetchSalesOfferMenu` | absent | stale dead code | Maps to shop-section/create-esim-order; zero callers |

## Environment base URLs

| Env | Android | iOS | Match |
|-----|---------|-----|-------|
| Dev | `dev.superapp.core.metac.libertyuconnect.com` | `dev.superapp.core.metac.libertyuconnect.com` | same |
| Staging | `stg.superapp.core.metac.libertyuconnect.com` | `stg.superapp.core.metac.libertyuconnect.com` | same |
| Pre-prod | `pre-prod.superapp.core.metac.libertyuconnect.com` | `pre-prod.superapp.core.metac.libertyuconnect.com` | same |
| Prod | `superapp.core.metac.libertyuconnect.com` | `superapp.core.metac.libertyuconnect.com` | same |

## Key patterns

- `uid` casing on every authenticated call — Android uid (lowercase header name); iOS UID (uppercase header name).
- 18 Android-only paths (Auth 2, Account 2, Storefront 1, Payments 5, Loyalty 7, Comms 1), including the Sigma/ESB payment paths `PA/sigma/widget-url`, `PA/sigma/{rebill-*}`, `PA/esb/topupBalance` with no iOS wiring.
- Orchestration split on `otp-update-and-set-link-account` — Android single combined request; iOS chains otp-update + set-account-info.
- Body drift on shared paths, mostly in Payments: `get-account-data-details`, `topup / third-party/topup`, `initiateBillPayment / third-party/…`, `get-payment-method-all-gateways`, `get-stored-payments`, `conversion-rate`.
- `+ lob` is sent on one platform only for `initiate-add-payment-method`, `validate-account`, `voucher-topup`.

---

Generated by API contract drift workflow · `docs/10-api-contract-drift.md`  
Market: Superapp Caribbean — Jamaica (JM) · SHAs: 0b03ae1f / 3124b4e0 · **Canvas (charts + tinted UI):** `superapp-jamaica-api-contract-drift.canvas.tsx`
