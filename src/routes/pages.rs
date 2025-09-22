use axum::{http::StatusCode, response::{Html, IntoResponse}};
use std::fs;

pub async fn handler() -> Html<String> {
    let html = fs::read_to_string("web/public/index.html")
        .unwrap_or_else(|_| "<h1>Could not load index.html</h1>".to_string());
    Html(html)
}

pub async fn about() -> Html<&'static str> {
    Html("<h1>About Page</h1><p>This is the about page of the WAM server.</p>")
}

pub async fn index_js() -> impl IntoResponse {
    match fs::read_to_string("web/src/index.js") {
        Ok(js) => (
            StatusCode::OK,
            [("Content-Type", "application/javascript")],
            js,
        ),
        Err(err) => (
            StatusCode::NOT_FOUND,
            [("Content-Type", "text/plain")],
            format!("Could not load index.js: {}", err).to_string(),
        ),
    }
}