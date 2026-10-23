import Foundation

struct CatalogClient {
    func loadProducts(aisleId: String) async -> [Product] {
        var components = URLComponents()
        components.path = "/v1/catalog/products"
        components.queryItems = [
            URLQueryItem(name: "category", value: aisleId),
            URLQueryItem(name: "sort", value: "relevance"),
        ]
        return await request(components)
    }

    func request(_ components: URLComponents) async -> [Product] {
        return []
    }
}
