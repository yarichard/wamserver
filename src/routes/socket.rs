use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use futures::{SinkExt, StreamExt};
use crate::WamServerState;
use crate::messaging::websocket::WsConnection;
use log::{error, info};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<WamServerState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: WamServerState) {
    let (mut sender, mut receiver) = socket.split();

    // Create a new subscription to the broadcast channel
    let mut rx = state.ws_sender.subscribe();

    // Create a new WsConnection and add it to the connections list
    let ws_conn = WsConnection::new(&state.ws_sender);
    let conn_id = ws_conn.id;
    
    {
        let mut connections = state.ws_connections.lock().unwrap();
        connections.push(ws_conn);
        info!("New WebSocket connection established: {}", conn_id);
    }

    // Handle incoming messages
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Err(e) = sender.send(msg).await {
                error!("Error sending message to client {}: {}", conn_id, e);
                break;
            }
        }
    });

    // Handle messages from the client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    info!("Received message from client {}: {}", conn_id, text);
                    // Broadcast the message to all clients
                    if let Err(e) = state.ws_sender.send(Message::Text(text)) {
                        error!("Error broadcasting message: {}", e);
                    }
                }
                Message::Close(_) => {
                    info!("Client {} disconnected", conn_id);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // Clean up: remove the connection from the list
    {
        let mut connections = state.ws_connections.lock().unwrap();
        connections.retain(|conn| conn.id != conn_id);
        info!("WebSocket connection removed: {}", conn_id);
    }
}