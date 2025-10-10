
use axum::{
    routing::get,
    routing::any,
    Router,
};
use tower_http::services::ServeDir;
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
    pub db: WamDatabase,
    pub ws_connections: Arc<Mutex<Vec<WsConnection>>>,
    pub ws_sender: broadcast::Sender<axum::extract::ws::Message>,
}

#[tokio::main]
async fn main() {

    dotenvy::dotenv().ok();

    Builder::new()
        .filter(None, LevelFilter::Info)
        .init();

    // Open database
    let db = database::WamDatabase::open().await;
    
    // Create broadcast channel for WebSocket messages
    let (ws_sender, _) = broadcast::channel(100);
    
    let state = WamServerState {
        db: db.clone(),
        ws_connections: Arc::new(Mutex::new(Vec::new())),
        ws_sender: ws_sender,
    };

    // build our application with a route
    let api_router = Router::new()
        .route("/about", get(routes::pages::about))
        .route("/ws", any(routes::socket::ws_handler))
        .route("/message", get(routes::services::get_messages).post(routes::services::create_message))
        .route("/info", get(routes::services::get_messages_count))
        .route("/user", get(routes::services::get_users).post(routes::services::create_user))
        .route("/parameters", get(routes::parameters::get_kafka_parameters))
        .with_state(state.clone());

    // Create static file service with proper MIME types
    let static_service = ServeDir::new("static")
        .append_index_html_on_directories(true);

    let app = Router::new()
        .merge(api_router)
        // Serve the static files directly from root, not from /static
        .fallback_service(static_service);

    // Launch Kafka consumer loop
    /*let _ = tokio::spawn(async move {
        messaging::kafka::consume_kafka_message(state).await;
    });*/

    // run it
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}