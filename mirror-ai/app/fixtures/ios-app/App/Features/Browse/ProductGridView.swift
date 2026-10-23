import SwiftUI

struct ProductGridView: View {
    @State private var products: [Product] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    private let routePath = "aisles"

    var body: some View {
        Text("Shop")
            .navigationTitle("Shop")
        if isLoading {
            ProgressView()
        } else if products.isEmpty {
            Text("Your shop is empty")
        } else if errorMessage != nil {
            Text("Shop is unavailable")
        } else {
            Text("grid")
        }
    }

    func reload(aisleId: String) async {
        products = await CatalogClient().loadProducts(aisleId: aisleId)
    }
}
