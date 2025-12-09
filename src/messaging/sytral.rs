use std::env;

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

/// Public API: fetch all real-time vehicles from SYTRAL SIRI-Lite JSON
async fn get_vehicles() -> Result<VehicleList> {
    let client = Client::new();
    let username = env::var("SYTRAL_USERNAME").expect("SYTRAL_USERNAME must be set");
    let password = env::var("SYTRAL_PASSWORD").expect("SYTRAL_PASSWORD must be set");
        
    let response = client.get(SYTRAL_URL)
    .basic_auth(&username, Some(&password))
    .send().await?;
    
    info!("Fetched SYTRAL data with status: {}", response.status());

    let siri_root: SiriRoot = response.json().await?;
    // print the first 500 characters of the response for debugging
    //let text = response.text().await?;
    //let snippet = &text[..std::cmp::min(500, text.len())];
    //info!("SYTRAL response snippet: {}", snippet);
    //let siri_root: SiriRoot = serde_json::from_str(&text)?;

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
async fn send_to_kafka(vehicle_list: &VehicleList) -> Result<()> {
    let kafka_url = env::var("KAFKA_URL").expect("KAFKA_URL must be set");
    let topic = "vehicles";
    
    // Convert to protobuf
    let proto_vehicles = to_proto_vehicle_list(vehicle_list);
    
    // Encode to bytes
    let mut buf = Vec::new();
    proto_vehicles.encode(&mut buf)?;
    
    // Create Kafka producer
    let mut producer = Producer::from_hosts(vec![kafka_url])
        .with_ack_timeout(std::time::Duration::from_secs(1))
        .with_required_acks(RequiredAcks::One)
        .create()?;
    
    // Send to Kafka
    producer.send(&Record::from_value(topic, buf))?;
    
    info!("Sent {} vehicles to Kafka topic '{}'", vehicle_list.vehicles.len(), topic);
    
    Ok(())
}

pub async fn sytral_handler(state: crate::WamServerState) -> () {
    loop {
        info!("Executing Sytral consuming loop");

        match get_vehicles().await {
            Ok(vehicles) => {
                info!("Fetched {} vehicles from SYTRAL", vehicles.vehicles.len());

                // Send to Kafka
                if let Err(e) = send_to_kafka(&vehicles).await {
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