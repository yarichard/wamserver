use axum::{
    response::Html,
    response::Json
};
use serde_json::{json};

pub async fn handler() -> Html<&'static str> {
    Html("<h1>Hello, World!</h1>")
}

use axum::http::{HeaderMap, HeaderValue};
use axum::response::IntoResponse;

pub async fn about() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert("content-type", HeaderValue::from_static("application/json"));
    
    (headers, Json(json!({ "data": 42 })))
}
