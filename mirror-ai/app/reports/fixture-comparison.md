# Mirror AI comparison

- Android: `/agent/mirror-ai/fixtures/android-app`
- iOS: `/agent/mirror-ai/fixtures/ios-app`
- Scope: full comparison
- Discovered modules: Just for You, Shop
- Skill: none
- Ruflo route: Coder

## Modules

### Just for You

- Mapping basis:
  - screen title "Just for You" on both platforms
  - shared endpoint GET /v1/feed/recommendations
  - shared model fields id, price, reason, title
  - call relationships: Android FeedApi → Recommendation, FeedRepository → Recommendation, RecommendationViewModel → FeedRepository; iOS PersonalizedShelfView → RecommendationItem, PersonalizedShelfView → ShelfLoader, RecommendationClient → RecommendationItem
- Android files:
  - `app/src/main/java/com/example/store/feed/FeedRepository.kt`
  - `app/src/main/java/com/example/store/feed/FeedScreen.kt`
  - `app/src/main/java/com/example/store/feed/Recommendation.kt`
  - `app/src/main/java/com/example/store/feed/RecommendationViewModel.kt`
- Android tests:
  - `app/src/test/java/com/example/store/feed/FeedFilterTest.kt`
- Android navigation:
  - `app/src/main/java/com/example/store/nav/NavHost.kt`
- Android routes: `home/for-you`
- Android endpoints: `GET /v1/feed/recommendations`
- iOS files:
  - `App/Features/Home/PersonalizedShelfView.swift`
  - `App/Features/Home/RecommendationItem.swift`
  - `App/Features/Home/ShelfLoader.swift`
- iOS tests:
  - `AppTests/ShelfTests.swift`
- iOS navigation:
  - `App/Router/AppRouter.swift`
- iOS routes: `for-you`
- iOS endpoints: `GET /v1/feed/recommendations`

### Shop

- Mapping basis:
  - screen title "Shop" on both platforms
  - shared endpoint GET /v1/catalog/products
  - shared model fields aisle, name, priceCents, sku
  - call relationships: Android AisleViewModel → CatalogApi, AisleViewModel → Product, CatalogApi → Product; iOS CatalogClient → Product, ProductGridView → CatalogClient, ProductGridView → Product
- Android files:
  - `app/src/main/java/com/example/store/catalog/AisleBrowser.kt`
  - `app/src/main/java/com/example/store/catalog/AisleViewModel.kt`
  - `app/src/main/java/com/example/store/catalog/CatalogApi.kt`
  - `app/src/main/java/com/example/store/catalog/Product.kt`
- Android tests:
  - `app/src/test/java/com/example/store/catalog/AisleEmptyTest.kt`
- Android navigation:
  - `app/src/main/java/com/example/store/nav/NavHost.kt`
- Android routes: `browse/aisles`
- Android endpoints: `GET /v1/catalog/products`
- iOS files:
  - `App/Features/Browse/CatalogClient.swift`
  - `App/Features/Browse/Product.swift`
  - `App/Features/Browse/ProductGridView.swift`
- iOS tests:
  - `AppTests/ProductGridTests.swift`
- iOS navigation:
  - `App/Router/AppRouter.swift`
- iOS routes: `aisles`
- iOS endpoints: `GET /v1/catalog/products`

## Findings

### 1. Just for You shapes results differently

- Severity: high
- Status: confirmed mismatch
- Category: Business logic and user flows
- Module: Just for You
- Android: `app/src/main/java/com/example/store/feed/RecommendationViewModel.kt:11`
- iOS: `App/Features/Home/ShelfLoader.swift:7`
- Difference: Android applies price > 0 and MAX_ITEMS = 12. iOS returns the fetched items with no matching filter or cap.
- Evidence: `app/src/main/java/com/example/store/feed/RecommendationViewModel.kt:11` `.filter { it.price > 0 }` `app/src/main/java/com/example/store/feed/RecommendationViewModel.kt:12` `.take(MAX_ITEMS)` `app/src/main/java/com/example/store/feed/RecommendationViewModel.kt:16` `const val MAX_ITEMS = 12` `App/Features/Home/ShelfLoader.swift:7` `return fetched`
- Suggested fix: Use the same result shaping on both platforms (price > 0 and MAX_ITEMS = 12). Put that rule in the loader that currently returns the fetched list unchanged, and test it on the platform that lacks coverage.

### 2. Shop query parameter name differs for categoryId

- Severity: high
- Status: confirmed mismatch
- Category: API and data parity
- Module: Shop
- Android: `app/src/main/java/com/example/store/catalog/CatalogApi.kt:9`
- iOS: `App/Features/Browse/CatalogClient.swift:8`
- Difference: Android sends categoryId on /v1/catalog/products. iOS sends category for the same request.
- Evidence: `app/src/main/java/com/example/store/catalog/CatalogApi.kt:9` `@Query("categoryId") categoryId: String,` `App/Features/Browse/CatalogClient.swift:8` `URLQueryItem(name: "category", value: aisleId),`
- Suggested fix: Use one query name on both clients. Android declares categoryId; rename the iOS item or the Android parameter so the contract matches.

### 3. Shop sends inStock only on Android

- Severity: high
- Status: confirmed mismatch
- Category: API and data parity
- Module: Shop
- Android: `app/src/main/java/com/example/store/catalog/AisleViewModel.kt:12`
- iOS: `App/Features/Browse/CatalogClient.swift:6`
- Difference: Android sends inStock=true on /v1/catalog/products. The iOS request does not include inStock.
- Evidence: `app/src/main/java/com/example/store/catalog/AisleViewModel.kt:12` `inStock = true,` `App/Features/Browse/CatalogClient.swift:6` `components.path = "/v1/catalog/products"`
- Suggested fix: Add inStock=true to the iOS query, or stop sending it from Android if the API should not receive it.

### 4. Shop sort query value differs

- Severity: high
- Status: confirmed mismatch
- Category: API and data parity
- Module: Shop
- Android: `app/src/main/java/com/example/store/catalog/AisleViewModel.kt:11`
- iOS: `App/Features/Browse/CatalogClient.swift:9`
- Difference: Android sends sort=popularity. iOS sends sort=relevance.
- Evidence: `app/src/main/java/com/example/store/catalog/AisleViewModel.kt:11` `sort = "popularity",` `App/Features/Browse/CatalogClient.swift:9` `URLQueryItem(name: "sort", value: "relevance"),`
- Suggested fix: Send the same sort value from both clients. Pick the value the API contract expects and update the other call site.

### 5. Just for You filter test is missing on iOS

- Severity: medium
- Status: confirmed mismatch
- Category: Test coverage and quality
- Module: Just for You
- Android: `app/src/test/java/com/example/store/feed/FeedFilterTest.kt:7`
- iOS: `AppTests/ShelfTests.swift:4`
- Difference: Android covers the filter scenario in filtersNonPositivePrices. iOS has testLoadsShelf and no filter test in this module.
- Evidence: `app/src/test/java/com/example/store/feed/FeedFilterTest.kt:7` `fun filtersNonPositivePrices() {` `AppTests/ShelfTests.swift:4` `func testLoadsShelf() {`
- Suggested fix: Add an iOS test for the filter scenario, parallel to filtersNonPositivePrices.

### 6. Shop empty test is missing on iOS

- Severity: medium
- Status: confirmed mismatch
- Category: Test coverage and quality
- Module: Shop
- Android: `app/src/test/java/com/example/store/catalog/AisleEmptyTest.kt:7`
- iOS: `AppTests/ProductGridTests.swift:4`
- Difference: Android covers the empty scenario in emptyAisleShowsMessage. iOS has testShowsProducts and no empty test in this module.
- Evidence: `app/src/test/java/com/example/store/catalog/AisleEmptyTest.kt:7` `fun emptyAisleShowsMessage() {` `AppTests/ProductGridTests.swift:4` `func testShowsProducts() {`
- Suggested fix: Add an iOS test for the empty scenario, parallel to emptyAisleShowsMessage.

### 7. Shop empty-state copy differs

- Severity: medium
- Status: confirmed mismatch
- Category: UI and design parity
- Module: Shop
- Android: `app/src/main/java/com/example/store/catalog/AisleBrowser.kt:15`
- iOS: `App/Features/Browse/ProductGridView.swift:15`
- Difference: Android empty copy is "No products in this aisle". iOS empty copy is "Your shop is empty".
- Evidence: `app/src/main/java/com/example/store/catalog/AisleBrowser.kt:15` `Text("No products in this aisle")` `App/Features/Browse/ProductGridView.swift:15` `Text("Your shop is empty")`
- Suggested fix: Use one empty-state string on both screens. "No products in this aisle" and "Your shop is empty" should be the same sentence.

### 8. Just for You loading treatment differs

- Severity: low
- Status: needs runtime verification
- Category: UI and design parity
- Module: Just for You
- Android: `app/src/main/java/com/example/store/feed/FeedScreen.kt:13`
- iOS: `App/Features/Home/PersonalizedShelfView.swift:13`
- Difference: Android loading UI uses skeleton (RecommendationSkeleton). iOS loading UI uses spinner (ProgressView). Both implement a loading state; source alone does not show whether the designs are supposed to match.
- Evidence: `app/src/main/java/com/example/store/feed/FeedScreen.kt:13` `RecommendationSkeleton()` `App/Features/Home/PersonalizedShelfView.swift:13` `ProgressView("Loading picks")`
- Suggested fix: Compare the loading state on both clients against the design. Align on a skeleton or a spinner if the feature is supposed to look the same.

### 9. Shop loading treatment differs

- Severity: low
- Status: needs runtime verification
- Category: UI and design parity
- Module: Shop
- Android: `app/src/main/java/com/example/store/catalog/AisleBrowser.kt:13`
- iOS: `App/Features/Browse/ProductGridView.swift:13`
- Difference: Android loading UI uses skeleton (ProductSkeleton). iOS loading UI uses spinner (ProgressView). Both implement a loading state; source alone does not show whether the designs are supposed to match.
- Evidence: `app/src/main/java/com/example/store/catalog/AisleBrowser.kt:13` `ProductSkeleton()` `App/Features/Browse/ProductGridView.swift:13` `ProgressView()`
- Suggested fix: Compare the loading state on both clients against the design. Align on a skeleton or a spinner if the feature is supposed to look the same.

## Analysis

Static comparison of screen titles, navigation routes, API endpoints, model fields, business rules, UI state copy, and call relationships. Keyword hints name a cluster after discovery; filenames are not matched.
