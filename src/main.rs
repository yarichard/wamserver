use std::env;

use axum::{
    routing::get, 
    routing::any,
    Router
};
use log::{LevelFilter, info};
use env_logger::Builder;

use crate::database::WamDatabase;
use kafka::consumer::{Consumer, FetchOffset};

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
        db: db.clone(),
    };

    // build our application with a route
    let app = Router::new()
    .route("/", get(routes::pages::handler))
    .route("/about", get(routes::pages::about))
    .route("/ws", any(routes::socket::ws_handler))
    .route("/message", get(routes::services::get_messages).post(routes::services::create_message))
    .route("/info", get(routes::services::get_messages_count))
    .route("/user", get(routes::services::get_users).post(routes::services::create_user))
    .with_state(state);

    // Launch Kafka consumer loop
    let _ = tokio::spawn(async {
        consume_kafka_message(db).await;
    });

    // run it
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}

async fn consume_kafka_message(db: WamDatabase){

    loop {
        info!("Executing Kafka consuming loop");
    
        // Create Kafka consumer
        let host = env::var("KAFKA_URL").expect("KAFKA_URL must be set");
        let topic: String = env::var("KAFKA_TOPIC").expect("KAFKA_TOPIC must be set");
        let group: String = env::var("KAFKA_GROUP").expect("KAFKA_GROUP must be set");
                
        let mut consumer =
        Consumer::from_hosts(vec!(host.to_owned()))
            .with_topic(topic.to_owned())
            .with_fallback_offset(FetchOffset::Earliest)
            .with_group(group)
            .with_offset_storage(Some(kafka::consumer::GroupOffsetStorage::Kafka))
            .create()
            .unwrap();

        for ms in consumer.poll().unwrap().iter() {
            for m in ms.messages() {
            let str = String::from_utf8_lossy(m.value);
            println!("Consuming message from Kafka \"topic\" {} : {:?}",topic, str);

            // Create message from string 
            let message = serde_json::from_str::<entity::message::Model>(&str)
                .map_err(|e| {
                    println!("Error parsing message: {}", e);
                });

                // Save message to database
                let _ = db.create_message(message.unwrap()).await;
            }
            let _ = consumer.consume_messageset(ms);
        }
        consumer.commit_consumed().unwrap();

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}