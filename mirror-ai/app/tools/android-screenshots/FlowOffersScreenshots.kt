package com.feature.postpaidline.flowoffers

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import com.core.common.model.account.AccountData
import com.core.common.model.base.LobType
import com.core.common.model.salesoffer.SalesJourney
import com.core.common.model.salesoffer.SalesJourneyTarget
import com.core.common.model.salesoffer.SalesOfferMenuLine
import com.core.common.model.salesoffer.SalesOfferMenuPlan
import com.designsystem.theme.SuperAppTheme
import com.feature.postpaidline.flowoffers.FlowOffersContract.State
import kotlinx.coroutines.flow.emptyFlow

/**
 * Renders the Flow Offers screen through layoutlib, off-device.
 *
 * The screen's own previews in `FlowOffersScreen.kt` are `private`, so nothing
 * outside that file can call them — Android Studio only renders them because it
 * invokes them reflectively. These four mirror the same states against the
 * public `FlowOffersScreen`, with the fixtures rebuilt from the originals.
 *
 * Keep these in step with the previews in `FlowOffersScreen.kt`; if a state is
 * added there, add it here.
 */
private fun postpaidAccount(): AccountData = AccountData(
    accountAlias = "My postpaid",
    msisdn = "18761234567",
    lob = LobType.POSTPAID.name,
    accountNumber = "1234567890",
)

/**
 * Literal copy rather than `stringResource`, so a frame does not silently change
 * when remote strings do. The wording is the English default of
 * `flow_offers_buy_new_postpaid_line` and `flow_offers_up_sale`.
 */
private fun salesOfferMenuLines(): List<SalesOfferMenuLine> = listOf(
    SalesOfferMenuLine(
        msisdn = null,
        recommendedLob = "POSTPAID",
        salesJourney = listOf(
            SalesJourney(
                titlePrimary = "Buy a new postpaid line",
                descriptionPrimary = "Add another line to your account",
                target = SalesJourneyTarget(targetType = "MODULE"),
            ),
        ),
        plans = listOf(
            SalesOfferMenuPlan(planName = "plan-id-1"),
            SalesOfferMenuPlan(planName = "plan-id-2"),
        ),
    ),
    SalesOfferMenuLine(
        msisdn = null,
        recommendedLob = "FIXED",
        salesJourney = listOf(
            SalesJourney(
                titlePrimary = "Upgrade your plan",
                descriptionPrimary = "See what else you could have",
                target = SalesJourneyTarget(targetType = "JOURNEY", journey = "upSell"),
            ),
        ),
        plans = emptyList(),
    ),
)

@Composable
private fun FlowOffers(state: State) {
    SuperAppTheme {
        FlowOffersScreen(
            state = state,
            effectFlow = emptyFlow(),
            onEvent = {},
            onBack = {},
            onNavigate = {},
        )
    }
}

/**
 * The plugin's JUnit engine discovers methods on a class carrying @PreviewTest.
 * A plain @Preview compiles but is never rendered.
 */
class FlowOffersScreenshots {

    @PreviewTest
    @Preview(showBackground = true, name = "flow_offers_loaded")
    @Composable
    fun flowOffersLoaded() {
        FlowOffers(
            State(
                isSalesOfferMenuLoading = false,
                salesOfferMenu = salesOfferMenuLines(),
                selectedAccount = postpaidAccount(),
                accounts = listOf(postpaidAccount()),
            ),
        )
    }

    @PreviewTest
    @Preview(showBackground = true, name = "flow_offers_empty_menu")
    @Composable
    fun flowOffersEmptyMenu() {
        FlowOffers(
            State(
                isSalesOfferMenuLoading = false,
                salesOfferMenu = emptyList(),
                selectedAccount = postpaidAccount(),
                accounts = listOf(postpaidAccount()),
            ),
        )
    }

    @PreviewTest
    @Preview(showBackground = true, name = "flow_offers_no_accounts")
    @Composable
    fun flowOffersNoAccounts() {
        FlowOffers(State(hasNoAccounts = true, isSalesOfferMenuLoading = false))
    }

    @PreviewTest
    @Preview(showBackground = true, name = "flow_offers_loading")
    @Composable
    fun flowOffersLoading() {
        FlowOffers(State(isSalesOfferMenuLoading = true))
    }
}
