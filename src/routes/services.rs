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

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageInfo{
    nb: u64
}

// POST 
#[debug_handler]
pub async fn create_message(state: State<WamServerState>, Json(message): Json<entity::message::Model>) -> Result<StatusCode, StatusCode>{
    let mut result = "Message created successfully".to_string();

    // First check that user exists
    let user = state.db.get_user(message.user_id).await;
    if user.is_err() {
        result = format!("User with id {} not found", message.user_id);
        error!("{result}");
        return Err(StatusCode::NOT_FOUND);
    }

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

#[debug_handler]
pub async fn create_user(state: State<WamServerState>, Json(user): Json<entity::user::Model>) -> Result<StatusCode, StatusCode>{
    let mut result = "Message created successfully".to_string();
    let res = state.db.create_user(user).await;
    
    match res {
        Ok(_) => {
            info!("{result}");
            Ok(StatusCode::OK)
        }
        Err(e) => {
            result = format!("Error creating user: {}", e);
            error!("{result}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_messages(state: State<WamServerState>) -> Json<Vec<entity::message::Model>> {
    let messages = state.db.get_messages().await.unwrap();
    Json(messages)
}

pub async fn get_messages_count(state: State<WamServerState>) -> Json<MessageInfo> {
    let nb = state.db.get_messages_count().await.unwrap();
    let info: MessageInfo = MessageInfo { nb: nb };
    Json(info)
}

pub async fn get_users(state: State<WamServerState>) -> Json<Vec<entity::user::Model>> {
    let users = state.db.get_users().await.unwrap_or_else(|_| vec![]);
    Json(users)
}