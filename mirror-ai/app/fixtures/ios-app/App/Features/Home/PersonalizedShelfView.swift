import SwiftUI

struct PersonalizedShelfView: View {
    @State private var items: [RecommendationItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    private let routePath = "for-you"

    var body: some View {
        Text("Just for You")
            .navigationTitle("Just for You")
        if isLoading {
            ProgressView("Loading picks")
        } else if items.isEmpty {
            Text("Nothing picked for you yet")
        } else if errorMessage != nil {
            Text("Couldn't load your picks")
        } else {
            Text("shelf")
        }
    }

    func reload() async {
        items = await ShelfLoader().load()
    }
}
