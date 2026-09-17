#English explanation no llm involved

def _confidence_phrase(confidence: float) -> str:
    pct = round(confidence * 100)
    if confidence >= 0.9:
        return f"very high confidence ({pct}%)"
    if confidence >= 0.7:
        return f"high confidence ({pct}%)"
    if confidence >= 0.5:
        return f"moderate confidence ({pct}%)"
    return f"low confidence ({pct}%)"


def _anomaly_phrase(anomaly_score: float) -> str:
    if anomaly_score >= 0.7:
        return "the traffic pattern is highly unusual compared to normal baseline behavior"
    if anomaly_score >= 0.4:
        return "the traffic pattern shows some deviation from normal baseline behavior"
    return "the traffic pattern is fairly close to normal baseline behavior"


def _evidence_reasoning(threat: str, evidence: dict) -> str:
    pps = evidence.get("flow_packets_per_sec", 0)
    bps = evidence.get("flow_bytes_per_sec", 0)
    duration = evidence.get("flow_duration", 0)
    port = evidence.get("destination_port", None)

    if threat == "DDoS":
        return (
            f"a packet rate of {pps:.1f} packets/sec and byte rate of {bps:.1f} bytes/sec "
            f"toward port {port}, consistent with a volumetric flood pattern"
        )
    if threat == "DoS":
        return (
            f"a sustained flow of {pps:.1f} packets/sec over {duration/1000:.1f} sec "
            f"toward port {port}, consistent with resource-exhaustion behavior"
        )
    if threat == "Port Scanning":
        return (
            f"a short, low-byte-volume flow ({bps:.1f} bytes/sec) toward port {port}, "
            f"consistent with probing/reconnaissance rather than real data transfer"
        )
    if threat == "Bots":
        return (
            f"a long-lived flow (duration {duration/1000:.1f} sec) with a very low data rate "
            f"({bps:.1f} bytes/sec) toward port {port}, consistent with beaconing-style traffic"
        )
    if threat == "Brute Force":
        return (
            f"repeated low-byte-volume connections toward port {port} "
            f"({bps:.1f} bytes/sec), consistent with automated credential guessing"
        )
    if threat == "Web Attacks":
        return (
            f"an application-layer flow toward port {port} with a byte rate of {bps:.1f} bytes/sec, "
            f"consistent with malicious HTTP-layer activity"
        )
    return f"traffic characteristics toward port {port} that diverge from the benign baseline"


def _recommended_action(severity: str) -> str:
    return {
        "CRITICAL": "Immediate investigation recommended — consider blocking the source.",
        "HIGH": "Investigate promptly — flag for analyst review.",
        "MEDIUM": "Monitor this source; escalate if the pattern repeats.",
        "LOW": "Log for visibility; no immediate action required.",
        "NONE": "No action required — traffic is benign.",
    }.get(severity, "Review manually.")


def generate_explanation(result: dict) -> str:
    threat = result["threat"]
    confidence = result["confidence"]
    anomaly_score = result["anomaly_score"]
    severity = result["severity"]
    risk_score = result["risk_score"]
    evidence = result["evidence"]

    if threat == "benign":
        anomaly_text = _anomaly_phrase(anomaly_score)
        anomaly_text = anomaly_text[0].upper() + anomaly_text[1:]
        return (
            f"This flow is classified as benign with {_confidence_phrase(confidence)}. "
            f"{anomaly_text}. No action required."
        )

    return (
        f"This flow is classified as {threat} with {_confidence_phrase(confidence)}. "
        f"The model observed {_evidence_reasoning(threat, evidence)}. "
        f"Also, {_anomaly_phrase(anomaly_score)} (anomaly score: {anomaly_score:.2f}). "
        f"Risk score: {risk_score}/100, severity: {severity}. "
        f"{_recommended_action(severity)}"
    )