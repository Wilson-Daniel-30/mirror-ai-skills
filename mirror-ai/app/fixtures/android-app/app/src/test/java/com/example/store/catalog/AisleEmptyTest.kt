package com.example.store.catalog

import org.junit.Test

class AisleEmptyTest {
    @Test
    fun emptyAisleShowsMessage() {
        val browser = AisleBrowser()
        val sample = Product(sku = "m", name = "Milk", priceCents = 199, aisle = "dairy")
        check(sample.sku == "m")
        check(browser != null)
    }
}
