package com.example.store.catalog

import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable

const val AISLE_ROUTE = "browse/aisles"

@Composable
fun AisleBrowser(state: AisleUiState) {
    TopAppBar(title = { Text("Shop") })
    if (state.isLoading) {
        ProductSkeleton()
    } else if (state.products.isEmpty()) {
        Text("No products in this aisle")
    } else if (state.error != null) {
        Text("Shop is unavailable")
    } else {
        ProductGrid(state.products)
    }
}
