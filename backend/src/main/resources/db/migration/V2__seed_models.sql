-- V2: Seed model registry — unified CICIDS2017 model (ml-repo)
INSERT INTO model_versions (name, version, model_type, threat_class, dataset, features_json, metrics_json, file_path, is_active)
VALUES
  ('dartnet-unified', 'ml-v1', 'RandomForest+IsolationForest', 'UNIFIED',
   'CICIDS2017',
   '["Destination Port","Flow Duration","Total Fwd Packets","Total Length of Fwd Packets","Fwd Packet Length Max","Fwd Packet Length Min","Fwd Packet Length Mean","Fwd Packet Length Std","Bwd Packet Length Max","Bwd Packet Length Min","Bwd Packet Length Mean","Bwd Packet Length Std","Flow Bytes/s","Flow Packets/s","Flow IAT Mean","Flow IAT Std","Flow IAT Max","Flow IAT Min","Fwd IAT Total","Fwd IAT Mean","Fwd IAT Std","Fwd IAT Max","Fwd IAT Min","Bwd IAT Total","Bwd IAT Mean","Bwd IAT Std","Bwd IAT Max","Bwd IAT Min","Fwd Header Length","Bwd Header Length","Fwd Packets/s","Bwd Packets/s","Min Packet Length","Max Packet Length","Packet Length Mean","Packet Length Std","Packet Length Variance","FIN Flag Count","PSH Flag Count","ACK Flag Count","Average Packet Size","Subflow Fwd Bytes","Init_Win_bytes_forward","Init_Win_bytes_backward","act_data_pkt_fwd","min_seg_size_forward","Active Mean","Active Max","Active Min","Idle Mean","Idle Max","Idle Min"]',
   '{"accuracy":0.9968,"weighted_f1":0.9975,"macro_f1":0.909,"trained_rows":2014144,"test_rows":503537}',
   'ml-repo/models/threat_classifier.joblib', true)
ON CONFLICT (name, version) DO NOTHING;
