package com.example.store.nav

fun AppNavHost() {
    composable(route = "home/for-you") { FeedScreen(state = FeedUiState()) }
    composable(route = "browse/aisles") { AisleBrowser(state = AisleUiState()) }
}
