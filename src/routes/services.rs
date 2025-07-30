use axum::http::StatusCode;
use axum::{Json};
use axum_macros::debug_handler;
use axum::extract::State;
use crate::WamServerState;
use log::{info, error};
use serde::{Deserialize, Serialize};


#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    message: String,
}

// POST 
#[debug_handler]
pub async fn create_message(state: State<WamServerState>, Json(message): Json<entity::message::Model>) -> Result<StatusCode, StatusCode>{
    let mut result = "Message created successfully".to_string();
    let res = state.db.create_message(message).await;
    
    match res {
        Ok(_) => {
            info!("{result}");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            result = format!("Error creating message: {}", e);
            error!("{result}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_messages(state: State<WamServerState>) -> Json<String> {
    let messages = state.db.get_messages().await;
    Json(messages
        .map(|msgs| serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|_| "[]".to_string())
    )
}