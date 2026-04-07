use axum::http::StatusCode;
use axum::{Json};
use axum_macros::debug_handler;
use axum::extract::{State, Path, Query};
use crate::auth::middleware::RequireAuth;
use crate::auth::password::hash_password;
use crate::messaging::websocket::{broadcast_message};
use crate::{WamServerState};
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
pub async fn create_message(state: State<WamServerState>, RequireAuth(_claims): RequireAuth, Json(message): Json<entity::message::Model>) -> Result<StatusCode, StatusCode>{

    // First check that user exists
    let user = state.db.get_user(message.user_id).await;
    if user.is_err() {
        let result = format!("User with id {} not found", message.user_id);
        error!("{result}");
        return Err(StatusCode::NOT_FOUND);
    }

    // Store message in DB
    let res = state.db.create_message(&message).await;
    
    match res {
        Ok(ser_msg) => {
            info!("Message successfully stored in database");

            // Broadcast message to WebSocket clients
            broadcast_message(&state.ws_sender, "message".to_string(), ser_msg)
                .unwrap_or_else(|e| {
                    error!("Error broadcasting message to WebSocket clients: {}", e);
                });

            Ok(StatusCode::OK)
        }
        Err(e) => {
            let result = format!("Error creating message: {}", e);
            error!("{result}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }

}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    name: String,
    email: String,
}

#[derive(Debug, Serialize)]
pub struct CreateUserResponse {
    id: i32,
    password: String,
}

#[debug_handler]
pub async fn create_user(
    state: State<WamServerState>,
    RequireAuth(_claims): RequireAuth,
    Json(req): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<CreateUserResponse>), StatusCode> {
    // Generate a random default password from a UUID
    let raw = uuid::Uuid::new_v4().to_string().replace('-', "");
    let password = raw[..12].to_string();

    let hash = hash_password(&password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = state
        .db
        .create_user_with_password(&req.name, &req.email, &hash)
        .await
        .map_err(|e| {
            error!("Error creating user: {}", e);
            StatusCode::CONFLICT
        })?;

    info!("User {} created successfully", user.id);
    Ok((StatusCode::CREATED, Json(CreateUserResponse { id: user.id, password })))
}

#[derive(Debug, Deserialize)]
pub struct EmailCheckQuery {
    email: String,
}

#[derive(Debug, Serialize)]
pub struct EmailCheckResponse {
    exists: bool,
}

pub async fn check_email(
    state: State<WamServerState>,
    RequireAuth(_claims): RequireAuth,
    Query(params): Query<EmailCheckQuery>,
) -> Json<EmailCheckResponse> {
    let exists = state.db.get_user_by_email(&params.email).await.is_ok();
    Json(EmailCheckResponse { exists })
}

pub async fn get_messages(state: State<WamServerState>, RequireAuth(_claims): RequireAuth) -> Json<Vec<entity::message::Model>> {
    let messages = state.db.get_messages().await.unwrap();
    Json(messages)
}

pub async fn get_messages_count(state: State<WamServerState>, RequireAuth(_claims): RequireAuth) -> Json<MessageInfo> {
    let nb = state.db.get_messages_count().await.unwrap();
    let info: MessageInfo = MessageInfo { nb: nb };
    Json(info)
}

pub async fn get_users(state: State<WamServerState>, RequireAuth(_claims): RequireAuth) -> Json<Vec<entity::user::Model>> {
    let users = state.db.get_users().await.unwrap_or_else(|_| vec![]);
    Json(users)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserRequest {
    name: String,
}

#[debug_handler]
pub async fn update_user(
    state: State<WamServerState>,
    RequireAuth(_claims): RequireAuth,
    Path(id): Path<i32>,
    Json(body): Json<UpdateUserRequest>,
) -> Result<StatusCode, StatusCode> {
    match state.db.update_user_name(id, body.name).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => {
            error!("Error updating user {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[debug_handler]
pub async fn delete_user(
    state: State<WamServerState>,
    RequireAuth(_claims): RequireAuth,
    Path(id): Path<i32>,
) -> Result<StatusCode, StatusCode> {
    match state.db.delete_user(id).await {
        Ok(_) => {
            info!("User {} deleted successfully", id);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            error!("Error deleting user {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

#[debug_handler]
pub async fn change_user_password(
    state: State<WamServerState>,
    RequireAuth(_claims): RequireAuth,
    Path(id): Path<i32>,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<StatusCode, StatusCode> {
    use crate::auth::password::{verify_password, hash_password};

    let user = state.db.get_user(id).await.map_err(|_| StatusCode::NOT_FOUND)?;

    if !verify_password(&body.current_password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let new_hash = hash_password(&body.new_password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match state.db.update_user_password(id, &new_hash).await {
        Ok(_) => {
            info!("Password updated for user {}", id);
            Ok(StatusCode::OK)
        }
        Err(e) => {
            error!("Error updating password for user {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}