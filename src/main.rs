use axum::{
    routing::get, 
    routing::any,
    Router
};
use log::{LevelFilter};
use env_logger::Builder;

use crate::database::WamDatabase;

pub mod routes;
pub mod database;

#[derive(Clone)]
pub struct WamServerState {
    pub db: WamDatabase,
}

#[tokio::main]
async fn main() {

    dotenvy::dotenv().ok();

    Builder::new()
        .filter(None, LevelFilter::Info)
        .init();

    // Open database
    let db = database::WamDatabase::open().await;
    let state = WamServerState {
        db: db,
    };

    // build our application with a route
    let app = Router::new()
    .route("/", get(routes::pages::handler))
    .route("/about", get(routes::pages::about))
    .route("/ws", any(routes::socket::ws_handler))
    .route("/message", get(routes::services::get_messages).post(routes::services::create_message))
    .route("/user", get(routes::services::get_users).post(routes::services::create_user))
    .with_state(state);

    // run it
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}