use axum::{
    response::Html,
    response::Json
};
use serde_json::{Value, json};

pub async fn handler() -> Html<&'static str> {
    Html("<h1>Hello, World!</h1>")
}

pub async fn about() -> Json<Value> {
    Json(json!({ "data": 42 }))
}
