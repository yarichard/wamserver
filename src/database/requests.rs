use sea_orm::*; 
use ::entity::message as message;

use crate::database::WamDatabase;

impl WamDatabase {
    pub async fn create_message(&self, msg: message::Model)-> Result<message::ActiveModel, DbErr> {
        message::ActiveModel{
                    text: Set(msg.text),
                    ..Default::default()
        }
        .save(&self.conn)
        .await
    }

    pub async fn get_messages(&self) -> Result<Vec<message::Model>, DbErr> {
        message::Entity::find()
            .all(&self.conn)
            .await
    }
}