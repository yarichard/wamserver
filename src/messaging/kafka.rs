use kafka::consumer::{Consumer, FetchOffset};
use std::env;
use log::{info, error};

use crate::WamServerState;

pub async fn consume_kafka_message(state: WamServerState) {

    loop {
        info!("Executing Kafka consuming loop");
    
        // Create Kafka consumer
        let host = env::var("KAFKA_URL").expect("KAFKA_URL must be set");
        let topic: String = env::var("KAFKA_TOPIC").expect("KAFKA_TOPIC must be set");
        let group: String = env::var("KAFKA_GROUP").expect("KAFKA_GROUP must be set");
                
        let consumer_res=
        Consumer::from_hosts(vec!(host.to_owned()))
            .with_topic(topic.to_owned())
            .with_fallback_offset(FetchOffset::Earliest)
            .with_group(group)
            .with_offset_storage(Some(kafka::consumer::GroupOffsetStorage::Kafka))
            .create();

        let _ = match consumer_res {
            Ok(mut c) => {
                for ms in c.poll().unwrap().iter() {
                    for m in ms.messages() {
                    let str = String::from_utf8_lossy(m.value);
                    println!("Consuming message from Kafka \"topic\" {} : {:?}",topic, str);

                    // Create message from string 
                    let message = serde_json::from_str::<entity::message::Model>(&str)
                        .map_err(|e| {
                            println!("Error parsing message: {}", e);
                        });

                        if message.is_ok(){
                            let ok_msg = message.as_ref().unwrap();
                            // Save message to database
                            let _ = state.db.create_message(ok_msg).await;

                            // Push message to web socket clients
                            if let Err(e) = state.ws_sender.send(axum::extract::ws::Message::Text(str.to_string().into())) {
                                error!("Error broadcasting message to WebSocket clients: {}", e);
                            }
                        } else {
                            error!("Error parsing message from Kafka: {:?}", message.err());
                            continue;
                        }
                    }
                    let _ = c.consume_messageset(ms);
                }
                c.commit_consumed().unwrap();
            },
            Err(e) => {
                error!("Error creating Kafka consumer: {}", e);
            }
        };

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}