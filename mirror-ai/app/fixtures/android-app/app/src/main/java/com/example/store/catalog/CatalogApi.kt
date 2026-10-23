package com.example.store.catalog

import retrofit2.http.GET
import retrofit2.http.Query

interface CatalogApi {
    @GET("/v1/catalog/products")
    suspend fun products(
        @Query("categoryId") categoryId: String,
        @Query("sort") sort: String,
        @Query("inStock") inStock: Boolean,
    ): List<Product>
}
