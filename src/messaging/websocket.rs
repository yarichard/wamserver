
use axum::extract::ws::Message;
use log::error;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

#[derive(Debug)]
pub struct WsConnection {
    pub id: usize,
    pub sender: Arc<broadcast::Sender<Message>>
}

#[derive(Serialize, Deserialize)]
pub struct WsMessage<T: Serialize> {
    pub msg_type: String,
    pub message: T,
}

impl WsConnection {
    pub fn new(sender: &Arc<broadcast::Sender<Message>>) -> Self {
        let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        Self { id, sender: Arc::clone(sender) }
    }
}

pub fn broadcast_message<T: Serialize>(sender: &Arc<broadcast::Sender<axum::extract::ws::Message>>, msg_type: String, message: T) -> Result<(), broadcast::error::SendError<Message>> {
    let msg_to_send = WsMessage {
        msg_type,
        message,
    };

    let msg_json = serde_json::to_string(&msg_to_send).unwrap_or_else(|_| "{}".to_string());
    if let Err(e) = sender.send(axum::extract::ws::Message::Text(msg_json.to_string().into())) {
        error!("Error broadcasting message to WebSocket clients: {}", e);
    }

    Ok(())
}