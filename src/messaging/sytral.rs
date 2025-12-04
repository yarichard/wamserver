use std::env;

use serde::{Deserialize, Serialize};
use reqwest::Client;
use log::{info, error};
use crate::messaging::websocket::{broadcast_message};

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
}

#[derive(Debug, Deserialize)]
struct VehicleLocation {
    #[serde(rename = "Longitude")]
    longitude: f64,
    #[serde(rename = "Latitude")]
    latitude: f64,
}

/// Public API: fetch all real-time vehicles from SYTRAL SIRI-Lite JSON
async fn get_vehicles() -> Result<VehicleList, Box<dyn std::error::Error>> {
    let client = Client::new();
    let username = env::var("SYTRAL_USERNAME").expect("SYTRAL_USERNAME must be set");
    let password = env::var("SYTRAL_PASSWORD").expect("SYTRAL_PASSWORD must be set");
        
    let response = client.get(SYTRAL_URL)
    .basic_auth(&username, Some(&password))
    .send().await?;
    
    info!("Fetched SYTRAL data with status: {}", response.status());
    let siri_root: SiriRoot = response.json().await?;

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
                });
            }
        }
    }

    Ok(VehicleList { vehicles })
}

pub async fn sytral_handler(state: crate::WamServerState) -> () {
    loop {
        info!("Executing Sytral consuming loop");

        match get_vehicles().await {
            Ok(vehicles) => {
                info!("Fetched {} vehicles from SYTRAL", vehicles.vehicles.len());

                // Broadcast message to WebSocket clients
                broadcast_message(&state.ws_sender, "sytral".to_string(), vehicles)
                    .unwrap_or_else(|e| {
                        error!("Error broadcasting message to WebSocket clients: {}", e);
                    });

                /*for vehicle in vehicles.vehicles.iter().take(5) {
                    info!(
                        "VehicleRef: {:?}, Line: {:?}, Direction: {:?}, Lat: {}, Lon: {}",
                        vehicle.vehicle_ref.as_ref().unwrap().as_str(),
                        vehicle.line.as_ref().unwrap().as_str(),
                        vehicle.direction.as_ref().unwrap().as_str(),
                        vehicle.latitude,
                        vehicle.longitude
                    );
                }*/
            }
            Err(e) => {
                info!("Error fetching vehicles from SYTRAL: {}", e);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}