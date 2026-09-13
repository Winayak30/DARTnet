-- V2: Seed initial model registry data
INSERT INTO model_versions (name, version, model_type, threat_class, dataset, features_json, metrics_json, file_path, is_active)
VALUES
  ('ddos', 'v1.0', 'RandomForest', 'SYN_FLOOD', 'SYNTHETIC',
   '["flow_rate","packet_rate","syn_ratio","unique_source_ips","source_entropy","dest_concentration","mean_packet_size","packets","bytes","duration_ms","syn_count"]',
   '{"precision":0.967,"recall":0.951,"f1":0.959,"false_positive_rate":0.032}',
   'models/ddos_model.joblib', true),
  ('portscan', 'v1.0', 'RandomForest', 'PORT_SCAN', 'SYNTHETIC',
   '["unique_dest_ports","unique_dest_hosts","fan_out","connection_rate","failed_connections","syn_without_ack","packet_count","duration_ms"]',
   '{"precision":0.981,"recall":0.974,"f1":0.977,"false_positive_rate":0.019}',
   'models/portscan_model.joblib', true),
  ('dns_dga', 'v1.0', 'RandomForest', 'DNS_TUNNEL', 'SYNTHETIC',
   '["domain_length","entropy","digit_ratio","consonant_ratio","unique_char_ratio","ngram_anomaly_score","query_rate","subdomain_depth","tld_suspicion"]',
   '{"precision":0.943,"recall":0.929,"f1":0.936,"false_positive_rate":0.057}',
   'models/dns_dga_model.joblib', true),
  ('c2', 'v1.0', 'XGBoost', 'C2_BEACON', 'SYNTHETIC',
   '["mean_inter_arrival_ms","inter_arrival_variance","periodicity_score","connection_count","unique_dest_count","flow_duration_ms","bytes_per_flow","small_packet_ratio"]',
   '{"precision":0.958,"recall":0.946,"f1":0.952,"false_positive_rate":0.042}',
   'models/c2_model.joblib', true),
  ('exfil', 'v1.0', 'RandomForest', 'DATA_EXFILTRATION', 'SYNTHETIC',
   '["outbound_bytes","inbound_bytes","outbound_inbound_ratio","flow_duration_ms","dest_concentration","transfer_rate_bps","burst_count"]',
   '{"precision":0.934,"recall":0.918,"f1":0.926,"false_positive_rate":0.066}',
   'models/exfil_model.joblib', true)
ON CONFLICT (name, version) DO NOTHING;
