use axum::{extract::State, Json};
use serde::Serialize;
use crate::auth::middleware::RequireAuth;
use crate::WamServerState;

#[derive(Serialize)]
pub struct KafkaParameters {
    kafka_url: String,
    kafka_topic: String,
    kafka_group: String,
}

pub async fn get_kafka_parameters(State(state): State<WamServerState>, RequireAuth(_claims): RequireAuth) -> Json<KafkaParameters> {
    let params = KafkaParameters {
        kafka_url: state.config.kafka_url.clone(),
        kafka_topic: state.config.kafka_topic.clone(),
        kafka_group: state.config.kafka_group.clone(),
    };

    Json(params)
}