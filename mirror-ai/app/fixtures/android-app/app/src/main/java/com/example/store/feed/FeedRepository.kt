package com.example.store.feed

import retrofit2.http.GET
import retrofit2.http.Query

interface FeedApi {
    @GET("/v1/feed/recommendations")
    suspend fun recommendations(@Query("limit") limit: Int): List<Recommendation>
}

class FeedRepository(private val api: FeedApi) {
    suspend fun fetchRecommendations(limit: Int): List<Recommendation> {
        return api.recommendations(limit).map { it.toModel() }
    }
}
