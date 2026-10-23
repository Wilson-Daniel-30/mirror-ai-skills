package com.example.store.feed

class RecommendationViewModel(
    private val repository: FeedRepository,
) {
    val screenTitle: String = "Just for You"

    suspend fun load(): List<Recommendation> {
        val response = repository.fetchRecommendations(limit = 20)
        return response
            .filter { it.price > 0 }
            .take(MAX_ITEMS)
    }

    companion object {
        const val MAX_ITEMS = 12
    }
}
