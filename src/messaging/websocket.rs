
use axum::extract::ws::Message;
use log::error;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

#[derive(Debug)]
pub struct WsConnection {
    pub id: usize,
}

#[derive(Serialize, Deserialize)]
pub struct WsMessage<T: Serialize> {
    pub msg_type: String,
    pub message: T,
}

impl WsConnection {
    pub fn new() -> Self {
        let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        Self { id }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn ws_message_serializes_with_correct_structure() {
        let msg = WsMessage {
            msg_type: "message".to_string(),
            message: serde_json::json!({"text": "hello", "user_id": 1}),
        };
        let json: Value = serde_json::from_str(&serde_json::to_string(&msg).unwrap()).unwrap();
        assert_eq!(json["msg_type"], "message");
        assert_eq!(json["message"]["text"], "hello");
        assert_eq!(json["message"]["user_id"], 1);
    }

    #[test]
    fn ws_message_serializes_sytral_type() {
        // Clients rely on the msg_type field to route messages — verify "sytral" is preserved
        let msg = WsMessage {
            msg_type: "sytral".to_string(),
            message: Vec::<String>::new(),
        };
        let json: Value = serde_json::from_str(&serde_json::to_string(&msg).unwrap()).unwrap();
        assert_eq!(json["msg_type"], "sytral");
    }

    #[test]
    fn ws_connection_ids_are_unique() {
        let c1 = WsConnection::new();
        let c2 = WsConnection::new();
        assert_ne!(c1.id, c2.id);
    }

    #[test]
    fn ws_connection_ids_increment() {
        let c1 = WsConnection::new();
        let c2 = WsConnection::new();
        assert_eq!(c2.id, c1.id + 1);
    }

    #[test]
    fn broadcast_with_no_receivers_returns_ok() {
        let (tx, _rx) = broadcast::channel::<Message>(16);
        // Drop the receiver so there are no active subscribers
        drop(_rx);
        let sender = Arc::new(tx);
        let result = broadcast_message(&sender, "test".to_string(), "payload");
        assert!(result.is_ok());
    }
}