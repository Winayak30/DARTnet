"""
NEXUS SOC Benchmark Script
SIH26145 - Performance measurement tool

Measures:
- flows/sec
- throughput Mbps
- average/p50/p95 detection latency
- dropped events
- CPU/memory usage

Run against a live backend instance.
"""

import time
import statistics
import json
import sys
import argparse
import threading
import requests
from datetime import datetime, timezone

def main():
    parser = argparse.ArgumentParser(description="NEXUS SOC Benchmark")
    parser.add_argument("--host", default="http://localhost:8080", help="Backend URL")
    parser.add_argument("--scenario", default="DDOS_SYN_FLOOD", help="Scenario to benchmark")
    parser.add_argument("--duration", type=int, default=60, help="Benchmark duration (seconds)")
    parser.add_argument("--speed", type=float, default=5.0, help="Replay speed multiplier")
    args = parser.parse_args()

    print(f"\nNEXUS SOC Benchmark")
    print(f"Target: {args.host}")
    print(f"Scenario: {args.scenario}")
    print(f"Duration: {args.duration}s at {args.speed}x speed")
    print("=" * 60)

    # Reset and start replay
    try:
        requests.post(f"{args.host}/api/replay/reset")
        r = requests.post(f"{args.host}/api/replay/start", json={
            "scenario": args.scenario,
            "speed": args.speed
        })
        print(f"Replay started: {r.status_code}")
    except Exception as e:
        print(f"Failed to start replay: {e}")
        sys.exit(1)

    # Collect metrics over duration
    samples = []
    start_time = time.time()

    print(f"\nCollecting metrics for {args.duration} seconds...")
    while time.time() - start_time < args.duration:
        try:
            r = requests.get(f"{args.host}/api/system/metrics?minutes=1", timeout=5)
            if r.status_code == 200:
                metrics_list = r.json()
                if metrics_list:
                    latest = metrics_list[-1]
                    samples.append(latest)
        except Exception as e:
            print(f"Metric collection error: {e}")
        time.sleep(1)

    # Stop replay
    requests.post(f"{args.host}/api/replay/stop")

    if not samples:
        print("No metrics collected!")
        sys.exit(1)

    # Aggregate results
    def extract(samples, key, default=0.0):
        return [s.get(key) or default for s in samples]

    packets = extract(samples, "packetsPerSec")
    throughputs = extract(samples, "throughputMbps")
    latencies_p50 = [v for v in extract(samples, "latencyP50Ms") if v > 0]
    latencies_p95 = [v for v in extract(samples, "latencyP95Ms") if v > 0]
    dropped = extract(samples, "droppedEvents")
    cpu = extract(samples, "cpuPercent")
    memory = extract(samples, "memoryPercent")

    results = {
        "benchmark_time": datetime.now(timezone.utc).isoformat(),
        "scenario": args.scenario,
        "duration_seconds": args.duration,
        "replay_speed": args.speed,
        "metrics": {
            "packets_per_sec": {
                "avg": statistics.mean(packets) if packets else 0,
                "max": max(packets) if packets else 0,
            },
            "throughput_mbps": {
                "avg": statistics.mean(throughputs) if throughputs else 0,
                "max": max(throughputs) if throughputs else 0,
            },
            "detection_latency_ms": {
                "p50_avg": statistics.mean(latencies_p50) if latencies_p50 else 0,
                "p95_avg": statistics.mean(latencies_p95) if latencies_p95 else 0,
            },
            "dropped_events": max(dropped) if dropped else 0,
            "cpu_percent": {
                "avg": statistics.mean(cpu) if cpu else 0,
                "max": max(cpu) if cpu else 0,
            },
            "memory_percent": {
                "avg": statistics.mean(memory) if memory else 0,
            },
            "sample_count": len(samples),
        }
    }

    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Packets/sec (avg):        {results['metrics']['packets_per_sec']['avg']:.1f}")
    print(f"Packets/sec (peak):       {results['metrics']['packets_per_sec']['max']:.1f}")
    print(f"Throughput avg (Mbps):    {results['metrics']['throughput_mbps']['avg']:.4f}")
    print(f"Throughput peak (Mbps):   {results['metrics']['throughput_mbps']['max']:.4f}")
    print(f"P50 detection latency:    {results['metrics']['detection_latency_ms']['p50_avg']:.1f}ms")
    print(f"P95 detection latency:    {results['metrics']['detection_latency_ms']['p95_avg']:.1f}ms")
    print(f"Dropped events:           {results['metrics']['dropped_events']}")
    print(f"CPU avg:                  {results['metrics']['cpu_percent']['avg']:.1f}%")
    print(f"Memory avg:               {results['metrics']['memory_percent']['avg']:.1f}%")
    print("=" * 60)

    # Save results
    out_file = f"benchmark_{args.scenario}_{int(time.time())}.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {out_file}")

    return results


if __name__ == "__main__":
    main()
