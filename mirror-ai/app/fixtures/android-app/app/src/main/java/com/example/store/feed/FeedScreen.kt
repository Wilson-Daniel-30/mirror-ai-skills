package com.example.store.feed

import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable

const val FEED_ROUTE = "home/for-you"

@Composable
fun FeedScreen(state: FeedUiState) {
    TopAppBar(title = { Text("Just for You") })
    if (state.isLoading) {
        RecommendationSkeleton()
    } else if (state.items.isEmpty()) {
        Text("Nothing picked for you yet")
    } else if (state.error != null) {
        Text("Couldn't load your picks")
    } else {
        RecommendationList(state.items)
    }
}
