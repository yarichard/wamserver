use sea_orm::*;
use ::entity::message as message;
use ::entity::user as user;
use chrono::Utc;

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

    pub async fn get_user_by_email(&self, email: &str) -> Result<user::Model, DbErr> {
        user::Entity::find()
            .filter(user::Column::Email.eq(email))
            .one(&self.conn)
            .await?
            .ok_or(DbErr::RecordNotFound(format!("User with email {} not found", email)))
    }

    pub async fn update_user_name(&self, id: i32, name: String) -> Result<user::Model, DbErr> {
        let user = self.get_user(id).await?;
        let mut active_user: user::ActiveModel = user.into();
        active_user.name = Set(name);
        active_user.update(&self.conn).await
    }

    pub async fn create_user_with_password(
        &self,
        name: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<user::Model, DbErr> {
        user::ActiveModel {
            name: Set(name.to_string()),
            email: Set(email.to_string()),
            password_hash: Set(password_hash.to_string()),
            created_at: Set(Utc::now().naive_utc()),
            ..Default::default()
        }
        .insert(&self.conn)
        .await
    }
}