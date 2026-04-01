use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{
        claims::encode_jwt,
        middleware::RequireAuth,
        password::{hash_password, verify_password},
    },
    WamServerState,
};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub id: i32,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub id: i32,
    pub name: String,
    pub email: String,
}

pub async fn register(
    State(state): State<WamServerState>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), StatusCode> {
    let hash = hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = state
        .db
        .create_user_with_password(&req.name, &req.email, &hash)
        .await
        .map_err(|_| StatusCode::CONFLICT)?;

    Ok((StatusCode::CREATED, Json(RegisterResponse { id: user.id })))
}

pub async fn login(
    State(state): State<WamServerState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let user = state
        .db
        .get_user_by_email(&req.email)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let ok = verify_password(&req.password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !ok {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = encode_jwt(user.id, &user.email, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse {
        access_token: token,
        token_type: "Bearer".to_string(),
        expires_in: 86400,
    }))
}

pub async fn get_me(
    State(state): State<WamServerState>,
    RequireAuth(claims): RequireAuth,
) -> Result<Json<MeResponse>, StatusCode> {
    let user = state
        .db
        .get_user(claims.sub)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(MeResponse {
        id: user.id,
        name: user.name,
        email: user.email,
    }))
}
