# NEXUS SOC — Known Limitations and Scope

## Dataset

The trained models use **synthetic data** generated with statistically representative parameters for each threat category. Actual performance on real-world traffic will differ.

For production validation:
- CIC-IDS2017 dataset (available from University of New Brunswick)
- UNSW-NB15 dataset
- BoT-IoT dataset

Use `scripts/seed_models.py` to update model metrics after real-dataset training.

## PCAP Ingestion

The current implementation uses a **synthetic scenario generator** rather than actual PCAP file parsing. The pipeline architecture supports PCAP ingestion via `pcap4j`, but the scenario generator produces representative traffic patterns for demonstration purposes.

To add real PCAP support: extend `ReplayEngine` to read from actual `.pcap` files using `pcap4j`.

## Throughput

The prototype is not optimized for high-throughput production use. The current architecture targets demo-scale traffic rates (hundreds to low thousands of packets/sec).

For production throughput (10+ Gbps), consider:
- NetFlow/IPFIX/sFlow hardware integration
- Parallel flow processing
- ML batch inference

## ML Model Quality

All reported metrics (Precision, Recall, F1, FPR) are **measured** on a held-out test set using time-aware splitting. They are computed during training and stored in the database.

Models trained on synthetic data should be retrained on real captured traffic before operational use.

## Detection Latency

Detection latency reflects actual pipeline timing but includes Java startup and JVM warmup overhead in the first few minutes of operation.

## Encrypted Traffic

The encrypted traffic analyzer uses metadata-only features. No payload decryption is implemented or possible. JA3/JA4 fingerprinting requires TLS handshake data which may not be available in all scenarios.

## Real-Time Performance

WebSocket broadcasting is best-effort. Under very high event rates, alerts may be batched or slightly delayed in the frontend.

## Single-Instance

The current deployment is single-instance. No clustering, sharding, or high availability configuration is provided.
