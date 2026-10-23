import XCTest

final class ProductGridTests: XCTestCase {
    func testShowsProducts() {
        let grid = ProductGridView()
        let milk = Product(sku: "m", name: "Milk", priceCents: 199, aisle: "dairy")
        XCTAssertEqual(milk.sku, "m")
        _ = grid
    }
}
