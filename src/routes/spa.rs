use axum::{
    response::{Response, IntoResponse},
    body::Body,
    http::{StatusCode, HeaderValue, header},
};
use std::fs;

pub async fn handle_spa_fallback() -> impl IntoResponse {
    match fs::read("static/index.html") {
        Ok(content) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"))
            .body(Body::from(content))
            .unwrap(),
        Err(_) => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"))
            .body(Body::from("Not Found"))
            .unwrap(),
    }
}