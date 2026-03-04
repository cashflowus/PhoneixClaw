import pytest

from services.global_monitor.src.kill_switch import KillSwitch


class TestKillSwitch:
    @pytest.mark.asyncio
    async def test_activate_sets_active(self):
        ks = KillSwitch(redis_client=None)
        await ks.activate("emergency")
        assert ks.is_active is True
        assert ks.reason == "emergency"
        assert ks.activated_at is not None

    @pytest.mark.asyncio
    async def test_deactivate_clears_state(self):
        ks = KillSwitch(redis_client=None)
        await ks.activate("test")
        await ks.deactivate()
        assert ks.is_active is False
        assert ks.reason == ""
        assert ks.activated_at is None

    def test_is_active_defaults_to_false(self):
        ks = KillSwitch(redis_client=None)
        assert ks.is_active is False

    @pytest.mark.asyncio
    async def test_activation_history_tracks_events(self):
        ks = KillSwitch(redis_client=None)
        await ks.activate("reason-1")
        await ks.deactivate()
        await ks.activate("reason-2")
        history = ks.history
        assert len(history) == 3
        assert history[0]["action"] == "activate"
        assert history[0]["reason"] == "reason-1"
        assert history[1]["action"] == "deactivate"
        assert history[2]["action"] == "activate"

    @pytest.mark.asyncio
    async def test_status_reports_activation_count(self):
        ks = KillSwitch(redis_client=None)
        await ks.activate("a")
        await ks.deactivate()
        await ks.activate("b")
        status = ks.status()
        assert status["activation_count"] == 2
        assert status["active"] is True

    @pytest.mark.asyncio
    async def test_history_returns_copy(self):
        ks = KillSwitch(redis_client=None)
        await ks.activate("x")
        h1 = ks.history
        h1.clear()
        assert len(ks.history) == 1
