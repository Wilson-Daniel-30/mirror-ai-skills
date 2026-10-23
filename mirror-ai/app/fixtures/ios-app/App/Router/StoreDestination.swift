import Foundation

enum StoreDestination: String, Hashable {
    case SHOP
    case FEED
    case CATALOG
    case AISLE

    /// iOS keeps the personalized shelf as its own destination.
    case SHELF
}
