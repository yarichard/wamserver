use axum::extract::{ws::{Message, WebSocket}, WebSocketUpgrade};
use serde_json::{Value};
use log::{info};

pub async fn ws_handler(ws: WebSocketUpgrade) -> axum::response::Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
    
        match msg {
            Ok(Message::Text(ref text)) => {
                match serde_json::from_str::<Value>(&text) {
                    Ok(json_data) => {
                        info!("Received JSON: {:?}", json_data);
                        // You can process json_data here
                    }
                    Err(e) => {
                        info!("Invalid JSON received: {}", e);
                    }
                }
            }
            Ok(ref other) => {
                info!("Message received: {other:?}");
            }
            Err(e) => {
                // client disconnected
                info!("Client disconnected: {}", e);
                return;
            }
        }

        if socket.send(msg.unwrap()).await.is_err() {
            // client disconnected
            info!("Client disconnected");
            return;
        }
    }
}