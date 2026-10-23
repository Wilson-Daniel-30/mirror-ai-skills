package com.example.store.catalog

data class Product(
    val sku: String,
    val name: String,
    val priceCents: Int,
    val aisle: String,
)
