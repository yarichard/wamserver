use std::env;
use anyhow::{Context, Result};

#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub kafka_url: String,
    pub kafka_topic: String,
    pub kafka_group: String,
    pub sytral_username: String,
    pub sytral_password: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://data/db.sqlite?mode=rwc".to_string()),
            kafka_url: env::var("KAFKA_URL").context("KAFKA_URL must be set")?,
            kafka_topic: env::var("KAFKA_TOPIC").context("KAFKA_TOPIC must be set")?,
            kafka_group: env::var("KAFKA_GROUP").context("KAFKA_GROUP must be set")?,
            sytral_username: env::var("SYTRAL_USERNAME").context("SYTRAL_USERNAME must be set")?,
            sytral_password: env::var("SYTRAL_PASSWORD").context("SYTRAL_PASSWORD must be set")?,
        })
    }
}
