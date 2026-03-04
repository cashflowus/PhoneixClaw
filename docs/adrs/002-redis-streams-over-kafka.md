# ADR 002: Redis Streams over Kafka

## Status

Accepted

## Context

We need an event bus for inter-service communication (trade signals, execution events, monitoring alerts, agent messages). Options include Kafka, Redis Streams, RabbitMQ, and NATS.

## Decision

Use **Redis Streams** as the primary event bus, implemented in `shared/events/bus.py` with `publish`, `subscribe`, and `ack` operations. Redis is already required for caching and session state.

## Consequences

- **Positive**: Simpler operations (no separate Kafka cluster), lower resource usage, single dependency for cache + events, adequate throughput for current scale
- **Negative**: Lower throughput than Kafka at very high message rates; less mature tooling for exactly-once and complex consumer groups
- **Mitigation**: If we outgrow Redis Streams, we can introduce a Kafka adapter behind the same event bus interface
