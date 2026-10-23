package com.example.store.catalog

class AisleViewModel(
    private val api: CatalogApi,
) {
    val screenTitle: String = "Shop"

    suspend fun load(aisleId: String): List<Product> {
        return api.products(
            categoryId = aisleId,
            sort = "popularity",
            inStock = true,
        )
    }
}
