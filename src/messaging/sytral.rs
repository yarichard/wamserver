use serde::{Deserialize, Serialize};
use reqwest::Client;
use log::{info, error};
use crate::messaging::websocket::{broadcast_message};
use chrono::{DateTime, Utc};
use kafka::producer::{Producer, Record, RequiredAcks};
use prost::Message;
use anyhow::Result;

// Include the generated protobuf code
pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/sytral.rs"));
}

const SYTRAL_URL: &str = "https://data.grandlyon.com/siri-lite/2.0/vehicle-monitoring.json";


/// High-level struct returned to the caller.
/// Clean and easy to work with.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vehicle {
    pub line: Option<String>,
    pub vehicle_ref: Option<String>,
    pub direction: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleList {
    vehicles: Vec<Vehicle>,
}

/// Helper struct for fields that have a "value" property
#[derive(Debug, Deserialize)]
struct ValueWrapper {
    value: String,
}

/// Root SIRI-Lite JSON mapping (internal use)
#[derive(Debug, Deserialize)]
struct SiriRoot {
    #[serde(rename = "Siri")]
    siri: Siri,
}

#[derive(Debug, Deserialize)]
struct Siri {
    #[serde(rename = "ServiceDelivery")]
    service_delivery: ServiceDelivery,
}

#[derive(Debug, Deserialize)]
struct ServiceDelivery {
    #[serde(rename = "VehicleMonitoringDelivery")]
    vehicle_monitoring_delivery: Vec<VehicleMonitoringDelivery>,
}

#[derive(Debug, Deserialize)]
struct VehicleMonitoringDelivery {
    #[serde(rename = "VehicleActivity")]
    vehicle_activity: Vec<VehicleActivity>,
}

#[derive(Debug, Deserialize)]
struct VehicleActivity {
    #[serde(rename = "MonitoredVehicleJourney")]
    mvj: MonitoredVehicleJourney,
}

#[derive(Debug, Deserialize)]
struct MonitoredVehicleJourney {
    #[serde(rename = "LineRef")]
    line_ref: Option<ValueWrapper>,

    #[serde(rename = "VehicleRef")]
    vehicle_ref: Option<ValueWrapper>,

    #[serde(rename = "DirectionRef")]
    direction_ref: Option<ValueWrapper>,

    #[serde(rename = "VehicleLocation")]
    vehicle_location: Option<VehicleLocation>,

    #[serde(rename = "RecordedAtTime")]
    timestamp: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct VehicleLocation {
    #[serde(rename = "Longitude")]
    longitude: f64,
    #[serde(rename = "Latitude")]
    latitude: f64,
}

/// Parse a SYTRAL SIRI-Lite JSON string into a VehicleList.
/// Vehicles without a VehicleLocation are silently skipped.
fn parse_vehicles_from_json(json: &str) -> Result<VehicleList> {
    let siri_root: SiriRoot = serde_json::from_str(json)?;
    let mut vehicles = Vec::new();

    for delivery in siri_root.siri.service_delivery.vehicle_monitoring_delivery {
        for activity in delivery.vehicle_activity {
            let mvj = activity.mvj;

            if let Some(loc) = mvj.vehicle_location {
                vehicles.push(Vehicle {
                    line: mvj.line_ref.map(|w| w.value),
                    vehicle_ref: mvj.vehicle_ref.map(|w| w.value),
                    direction: mvj.direction_ref.map(|w| w.value),
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    timestamp: mvj.timestamp.unwrap_or_else(|| Utc::now()),
                });
            }
        }
    }

    Ok(VehicleList { vehicles })
}

/// Public API: fetch all real-time vehicles from SYTRAL SIRI-Lite JSON
async fn get_vehicles(username: &str, password: &str) -> Result<VehicleList> {
    let client = Client::new();

    let response = client.get(SYTRAL_URL)
    .basic_auth(username, Some(password))
    .send().await?;

    info!("Fetched SYTRAL data with status: {}", response.status());

    let text = response.text().await?;
    parse_vehicles_from_json(&text)
}

/// Convert VehicleList to protobuf format
fn to_proto_vehicle_list(vehicle_list: &VehicleList) -> proto::VehicleList {
    proto::VehicleList {
        vehicles: vehicle_list.vehicles.iter().map(|v| proto::Vehicle {
            line: v.line.clone().unwrap_or_default(),
            vehicle_ref: v.vehicle_ref.clone().unwrap_or_default(),
            direction: v.direction.clone().unwrap_or_default(),
            latitude: v.latitude,
            longitude: v.longitude,
            timestamp: v.timestamp.timestamp(),
        }).collect(),
    }
}

/// Send VehicleList to Kafka using protobuf encoding
async fn send_to_kafka(vehicle_list: &VehicleList, kafka_url: &str) -> Result<()> {
    let topic = "vehicles";
    
    // Convert to protobuf
    let proto_vehicles = to_proto_vehicle_list(vehicle_list);
    
    // Encode to bytes
    let mut buf = Vec::new();
    proto_vehicles.encode(&mut buf)?;
    
    // Create Kafka producer
    let mut producer = Producer::from_hosts(vec![kafka_url.to_string()])
        .with_ack_timeout(std::time::Duration::from_secs(1))
        .with_required_acks(RequiredAcks::One)
        .create()?;
    
    // Send to Kafka
    producer.send(&Record::from_value(topic, buf))?;
    
    info!("Sent {} vehicles to Kafka topic '{}'", vehicle_list.vehicles.len(), topic);
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sytral_json(mvj_fields: &str) -> String {
        format!(
            r#"{{
                "Siri": {{
                    "ServiceDelivery": {{
                        "VehicleMonitoringDelivery": [{{
                            "VehicleActivity": [{{
                                "MonitoredVehicleJourney": {{ {mvj_fields} }}
                            }}]
                        }}]
                    }}
                }}
            }}"#
        )
    }

    fn full_mvj() -> String {
        sytral_json(r#"
            "LineRef": {"value": "T1"},
            "VehicleRef": {"value": "V42"},
            "DirectionRef": {"value": "Inbound"},
            "VehicleLocation": {"Longitude": 4.8357, "Latitude": 45.7640},
            "RecordedAtTime": "2024-01-15T10:30:00Z"
        "#)
    }

    #[test]
    fn parse_vehicle_with_all_fields() {
        let result = parse_vehicles_from_json(&full_mvj()).unwrap();
        assert_eq!(result.vehicles.len(), 1);
        let v = &result.vehicles[0];
        assert_eq!(v.line.as_deref(), Some("T1"));
        assert_eq!(v.vehicle_ref.as_deref(), Some("V42"));
        assert_eq!(v.direction.as_deref(), Some("Inbound"));
        assert!((v.latitude - 45.7640).abs() < 1e-4);
        assert!((v.longitude - 4.8357).abs() < 1e-4);
    }

    #[test]
    fn parse_vehicle_without_location_is_skipped() {
        let json = sytral_json(r#"
            "LineRef": {"value": "T2"},
            "VehicleRef": {"value": "V99"}
        "#);
        let result = parse_vehicles_from_json(&json).unwrap();
        assert_eq!(result.vehicles.len(), 0, "vehicle without location must be skipped");
    }

    #[test]
    fn parse_vehicle_with_missing_optional_fields() {
        let json = sytral_json(r#"
            "VehicleLocation": {"Longitude": 4.83, "Latitude": 45.75},
            "RecordedAtTime": "2024-06-01T08:00:00Z"
        "#);
        let result = parse_vehicles_from_json(&json).unwrap();
        assert_eq!(result.vehicles.len(), 1);
        let v = &result.vehicles[0];
        assert!(v.line.is_none());
        assert!(v.vehicle_ref.is_none());
        assert!(v.direction.is_none());
    }

    #[test]
    fn parse_vehicle_with_missing_timestamp_still_parses() {
        let json = sytral_json(r#"
            "VehicleLocation": {"Longitude": 4.83, "Latitude": 45.75}
        "#);
        // Should not error — missing timestamp falls back to Utc::now()
        let result = parse_vehicles_from_json(&json).unwrap();
        assert_eq!(result.vehicles.len(), 1);
    }

    #[test]
    fn parse_invalid_json_returns_error() {
        assert!(parse_vehicles_from_json("not json at all").is_err());
    }

    #[test]
    fn proto_conversion_preserves_coordinates_and_timestamp() {
        let result = parse_vehicles_from_json(&full_mvj()).unwrap();
        let proto = to_proto_vehicle_list(&result);
        assert_eq!(proto.vehicles.len(), 1);
        let pv = &proto.vehicles[0];
        assert!((pv.latitude - 45.7640).abs() < 1e-4);
        assert!((pv.longitude - 4.8357).abs() < 1e-4);
        // 2024-01-15T10:30:00Z → unix timestamp 1705314600
        assert_eq!(pv.timestamp, 1705314600);
    }

    #[test]
    fn proto_conversion_maps_none_fields_to_empty_string() {
        let vehicle_list = VehicleList {
            vehicles: vec![Vehicle {
                line: None,
                vehicle_ref: None,
                direction: None,
                latitude: 45.0,
                longitude: 4.0,
                timestamp: Utc::now(),
            }],
        };
        let proto = to_proto_vehicle_list(&vehicle_list);
        let pv = &proto.vehicles[0];
        assert_eq!(pv.line, "");
        assert_eq!(pv.vehicle_ref, "");
        assert_eq!(pv.direction, "");
    }
}

pub async fn sytral_handler(state: crate::WamServerState) -> () {
    loop {
        info!("Executing Sytral consuming loop");

        match get_vehicles(&state.config.sytral_username, &state.config.sytral_password).await {
            Ok(vehicles) => {
                info!("Fetched {} vehicles from SYTRAL", vehicles.vehicles.len());

                // Send to Kafka
                if let Err(e) = send_to_kafka(&vehicles, &state.config.kafka_url).await {
                    error!("Error sending vehicles to Kafka: {}", e);
                }

                // Broadcast message to WebSocket clients
                broadcast_message(&state.ws_sender, "sytral".to_string(), vehicles)
                    .unwrap_or_else(|e| {
                        error!("Error broadcasting message to WebSocket clients: {}", e);
                    });

                
            }
            Err(e) => {
                info!("Error fetching vehicles from SYTRAL: {}", e);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}