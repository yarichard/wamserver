use axum::{
    routing::get, 
    routing::any,
    Router
};
use log::{LevelFilter};
use env_logger::Builder;

pub mod routes;

#[tokio::main]
async fn main() {
    // build our application with a route
    let app = Router::new()
    .route("/", get(routes::pages::handler))
    .route("/about", get(routes::pages::about))
    .route("/ws", any(routes::socket::ws_handler));

    Builder::new()
        .filter(None, LevelFilter::Info)
        .init();

    // run it
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}