import Foundation

struct Product: Codable, Identifiable {
    let sku: String
    let name: String
    let priceCents: Int
    let aisle: String
}
