import httpx
import pytest
import respx

from shared.broker.alpaca_adapter import AlpacaBrokerAdapter


@pytest.fixture
def adapter():
    return AlpacaBrokerAdapter(api_key="test-key", secret_key="test-secret", paper=True)


class TestAlpacaBrokerAdapter:
    def test_format_option_symbol(self, adapter):
        symbol = adapter.format_option_symbol("SPX", "2026-02-20", "CALL", 6940.0)
        assert "SPX" in symbol
        assert "C" in symbol
        assert "260220" in symbol

    @pytest.mark.asyncio
    @respx.mock
    async def test_place_limit_order(self, adapter):
        respx.post("https://paper-api.alpaca.markets/v2/orders").mock(
            return_value=httpx.Response(200, json={"id": "order-123", "status": "accepted"})
        )
        order_id = await adapter.place_limit_order("SPX260220C06940000", 1, "BUY", 4.80)
        assert order_id == "order-123"

    @pytest.mark.asyncio
    @respx.mock
    async def test_get_account(self, adapter):
        respx.get("https://paper-api.alpaca.markets/v2/account").mock(
            return_value=httpx.Response(
                200,
                json={
                    "buying_power": "50000.00",
                    "cash": "50000.00",
                    "equity": "50000.00",
                    "portfolio_value": "50000.00",
                },
            )
        )
        account = await adapter.get_account()
        assert account["buying_power"] == 50000.0

    @pytest.mark.asyncio
    @respx.mock
    async def test_cancel_order(self, adapter):
        respx.delete("https://paper-api.alpaca.markets/v2/orders/order-456").mock(
            return_value=httpx.Response(204)
        )
        result = await adapter.cancel_order("order-456")
        assert result is True

    @pytest.mark.asyncio
    @respx.mock
    async def test_get_order_status(self, adapter):
        respx.get("https://paper-api.alpaca.markets/v2/orders/order-789").mock(
            return_value=httpx.Response(
                200,
                json={
                    "status": "filled",
                    "filled_qty": "1",
                    "filled_avg_price": "4.90",
                },
            )
        )
        status = await adapter.get_order_status("order-789")
        assert status["status"] == "filled"
        assert status["filled_qty"] == 1
