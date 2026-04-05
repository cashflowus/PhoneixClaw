"""Unit tests for V3 database models (shared.db.models).

Replaces original V1 tests that imported from shared.models.trade (removed).
"""

from shared.db.models import (
    AgentMetric,
    AgentTrade,
    AuditLog,
    Base,
    Connector,
    ConnectorAgent,
    Position,
    TradeIntent,
    TradingAccount,
    User,
)


class TestUserModel:
    def test_user_has_required_columns(self):
        assert hasattr(User, "id")
        assert hasattr(User, "email")
        assert hasattr(User, "is_active")

    def test_user_tablename(self):
        assert User.__tablename__ == "users"


class TestTradingAccountModel:
    def test_has_required_fields(self):
        assert hasattr(TradingAccount, "user_id")
        assert hasattr(TradingAccount, "broker")
        assert hasattr(TradingAccount, "credentials_encrypted")
        assert hasattr(TradingAccount, "account_type")

    def test_has_balance_fields(self):
        assert hasattr(TradingAccount, "balance")
        assert hasattr(TradingAccount, "buying_power")
        assert hasattr(TradingAccount, "equity")

    def test_tablename(self):
        assert TradingAccount.__tablename__ == "trading_accounts"


class TestConnectorModel:
    def test_has_required_fields(self):
        assert hasattr(Connector, "user_id")
        assert hasattr(Connector, "type")
        assert hasattr(Connector, "credentials_encrypted")
        assert hasattr(Connector, "status")

    def test_tablename(self):
        assert Connector.__tablename__ == "connectors"


class TestConnectorAgentModel:
    def test_has_required_fields(self):
        assert hasattr(ConnectorAgent, "connector_id")
        assert hasattr(ConnectorAgent, "agent_id")
        assert hasattr(ConnectorAgent, "is_active")

    def test_tablename(self):
        assert ConnectorAgent.__tablename__ == "connector_agents"


class TestTradeIntentModel:
    def test_has_required_fields(self):
        assert hasattr(TradeIntent, "agent_id")
        assert hasattr(TradeIntent, "account_id")
        assert hasattr(TradeIntent, "symbol")
        assert hasattr(TradeIntent, "side")

    def test_has_execution_fields(self):
        assert hasattr(TradeIntent, "fill_price")
        assert hasattr(TradeIntent, "broker_order_id")
        assert hasattr(TradeIntent, "status")

    def test_tablename(self):
        assert TradeIntent.__tablename__ == "trade_intents"


class TestPositionModel:
    def test_has_required_fields(self):
        assert hasattr(Position, "agent_id")
        assert hasattr(Position, "account_id")
        assert hasattr(Position, "symbol")
        assert hasattr(Position, "side")

    def test_has_exit_fields(self):
        assert hasattr(Position, "take_profit")
        assert hasattr(Position, "stop_loss")
        assert hasattr(Position, "exit_reason")
        assert hasattr(Position, "realized_pnl")

    def test_tablename(self):
        assert Position.__tablename__ == "positions"


class TestAuditLogModel:
    def test_has_audit_fields(self):
        assert hasattr(AuditLog, "user_id")
        assert hasattr(AuditLog, "action")
        assert hasattr(AuditLog, "target_type")
        assert hasattr(AuditLog, "target_id")

    def test_tablename(self):
        assert AuditLog.__tablename__ == "audit_logs"


class TestAgentMetricModel:
    def test_has_metric_fields(self):
        assert hasattr(AgentMetric, "agent_id")
        assert hasattr(AgentMetric, "portfolio_value")
        assert hasattr(AgentMetric, "daily_pnl")
        assert hasattr(AgentMetric, "win_rate")

    def test_tablename(self):
        assert AgentMetric.__tablename__ == "agent_metrics"


class TestAgentTradeModel:
    def test_has_trade_fields(self):
        assert hasattr(AgentTrade, "agent_id")
        assert hasattr(AgentTrade, "ticker")
        assert hasattr(AgentTrade, "side")
        assert hasattr(AgentTrade, "entry_price")

    def test_tablename(self):
        assert AgentTrade.__tablename__ == "agent_trades"


class TestAllModelsHaveBase:
    def test_all_inherit_from_base(self):
        models = [
            User, TradingAccount, Connector, ConnectorAgent,
            TradeIntent, Position, AuditLog, AgentMetric, AgentTrade,
        ]
        for model in models:
            assert issubclass(model, Base), f"{model.__name__} does not inherit from Base"
