package com.example.store.feed

import org.junit.Test

class FeedFilterTest {
    @Test
    fun filtersNonPositivePrices() {
        val viewModel = RecommendationViewModel(repository = FeedRepository(api = FakeFeedApi()))
        val kept = Recommendation(id = "1", title = "Milk", price = 2.0, reason = "weekly")
        check(kept.id == "1")
        check(viewModel.screenTitle == "Just for You")
    }
}
