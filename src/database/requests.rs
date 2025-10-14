use sea_orm::*; 
use ::entity::message as message;
use ::entity::user as user;

use crate::database::WamDatabase;

impl WamDatabase {
    pub async fn create_message(&self, msg: &message::Model)-> Result<message::Model, DbErr> {
        message::ActiveModel{
                    text: Set(msg.text.clone()),
                    user_id: Set(msg.user_id),
                    ..Default::default()
        }
        .insert(&self.conn)
        .await
    }

    pub async fn create_user(&self, user: user::Model)-> Result<user::Model, DbErr> {
        user::ActiveModel{
                    name: Set(user.name),
                    email: Set(user.email),
                    ..Default::default()
        }
        .insert(&self.conn)
        .await
    }

    pub async fn get_messages(&self) -> Result<Vec<message::Model>, DbErr> {
        message::Entity::find()
            .all(&self.conn)
            .await
    }

    pub async fn get_messages_count(&self) -> Result<u64, DbErr> {
        message::Entity::find()
            .count(&self.conn)
            .await
    }

    pub async fn get_users(&self) -> Result<Vec<user::Model>, DbErr> {
        user::Entity::find()
            .all(&self.conn)
            .await
    }

    pub async fn get_user(&self, user_id: i32) -> Result<user::Model, DbErr> {
        user::Entity::find()
            .filter(user::Column::Id.eq(user_id))
            .one(&self.conn)
            .await?
            .ok_or(DbErr::RecordNotFound(format!("User with id {} not found", user_id)))
    }
}