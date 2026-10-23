package com.example.store.nav

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class StoreModuleType {
    @SerialName("SHOP")
    SHOP,

    @SerialName("FEED")
    FEED,

    @SerialName("CATALOG")
    CATALOG,

    @SerialName("AISLE")
    AISLE,

    @SerialName("CHECKOUT")
    CHECKOUT;

    companion object {
        fun fromString(value: String): StoreModuleType? = entries.find { it.name == value }
    }
}
