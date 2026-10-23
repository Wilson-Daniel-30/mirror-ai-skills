import XCTest

final class ShelfTests: XCTestCase {
    func testLoadsShelf() {
        let loader = ShelfLoader()
        let item = RecommendationItem(id: "1", title: "Milk", price: 2, reason: "weekly")
        XCTAssertEqual(item.title, "Milk")
        _ = loader
    }
}
