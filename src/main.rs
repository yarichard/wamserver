
use axum::{
    routing::get,
    routing::any,
    Router,
    response::IntoResponse,
    http::Method,
};
use tower_http::{
    services::ServeDir,
    cors::CorsLayer,
};
use log::{LevelFilter};
use env_logger::Builder;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

use crate::database::WamDatabase;
use crate::messaging::websocket::WsConnection;

pub mod routes;
pub mod database;
pub mod messaging;

#[derive(Clone)]
pub struct WamServerState {
    pub db: Arc<WamDatabase>,
    pub ws_connections: Arc<Mutex<Vec<WsConnection>>>,
    pub ws_sender: Arc<broadcast::Sender<axum::extract::ws::Message>>,
}

impl WamServerState {
    pub fn get_db(&self) -> &WamDatabase {
        &self.db
    }
}

#[tokio::main]
async fn main() {

    dotenvy::dotenv().ok();

    Builder::new()
        .filter(None, LevelFilter::Info)
        .init();

    // Create broadcast channel for WebSocket messages
    let (ws_sender, _) = broadcast::channel(100);
    
    let state = WamServerState {
        db: Arc::new(database::WamDatabase::open().await),
        ws_connections: Arc::new(Mutex::new(Vec::new())),
        ws_sender: Arc::new(ws_sender),
    };

    
    // build our application with a route
    let api_router = Router::new()
        .route("/ws", any(routes::socket::ws_handler))
        .route("/message", get(routes::services::get_messages).post(routes::services::create_message))
        .route("/info", get(routes::services::get_messages_count))
        .route("/user", get(routes::services::get_users).post(routes::services::create_user))
        .route("/parameters", get(routes::parameters::get_kafka_parameters))
        .with_state(state.clone());

    // Create static file service with proper MIME types
    async fn serve_index() -> impl IntoResponse {
        let index_path = std::path::Path::new("static/index.html");
        match tokio::fs::read_to_string(index_path).await {
            Ok(content) => axum::response::Html(content).into_response(),
            Err(_) => (
                axum::http::StatusCode::NOT_FOUND,
                "Not Found"
            ).into_response(),
        }
    }

    // Handle SPA routes
    let spa_routes = Router::new()
        .route("/front/{*page}", get(serve_index));

    // Serve static files
    let static_service = ServeDir::new("static")
        .append_index_html_on_directories(true);

    // Configure CORS for Docker environment
    let cors = CorsLayer::new()
        // Allow all origins since we're in a Docker environment
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS, Method::HEAD, Method::PATCH])
        .allow_headers(tower_http::cors::Any)
        .expose_headers(tower_http::cors::Any)
        .max_age(std::time::Duration::from_secs(3600));

    let app = Router::new()
        .route("/about", get(routes::pages::about))
        .nest("/api", api_router)
        .merge(spa_routes)
        .layer(cors)
        .fallback_service(static_service);

    let cloned_state: WamServerState = state.clone();
    let _ = tokio::spawn(async move {
        messaging::kafka::consume_kafka_message(state.clone()).await
    });

    let _ = tokio::spawn(async move {
        messaging::sytral::sytral_handler(cloned_state.clone()).await;
    });

    // run it
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}