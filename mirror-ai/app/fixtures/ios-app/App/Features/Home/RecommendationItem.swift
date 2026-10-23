import Foundation

struct RecommendationItem: Codable, Identifiable {
    let id: String
    let title: String
    let price: Double
    let reason: String
}
