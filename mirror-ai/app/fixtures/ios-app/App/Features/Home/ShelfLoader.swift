import Foundation

struct ShelfLoader {
    func load() async -> [RecommendationItem] {
        let client = RecommendationClient()
        let fetched = await client.fetch(limit: 20)
        return fetched
    }
}

struct RecommendationClient {
    func fetch(limit: Int) async -> [RecommendationItem] {
        var components = URLComponents()
        components.path = "/v1/feed/recommendations"
        components.queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        return await request(components)
    }

    func request(_ components: URLComponents) async -> [RecommendationItem] {
        return []
    }
}
