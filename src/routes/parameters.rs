use axum::Json;
use serde::Serialize;
use std::env;

#[derive(Serialize)]
pub struct KafkaParameters {
    kafka_url: String,
    kafka_topic: String,
    kafka_group: String,
}

pub async fn get_kafka_parameters() -> Json<KafkaParameters> {
    let params = KafkaParameters {
        kafka_url: env::var("KAFKA_URL").unwrap_or_default(),
        kafka_topic: env::var("KAFKA_TOPIC").unwrap_or_default(),
        kafka_group: env::var("KAFKA_GROUP").unwrap_or_default(),
    };
    
    Json(params)
}