use log::info;
use sea_orm::{Database, DatabaseConnection};
use migration::{Migrator, MigratorTrait};

pub mod requests;

#[derive(Clone)]
pub struct WamDatabase {
    pub conn: DatabaseConnection,
}

impl WamDatabase {
    pub async fn open(database_url: &str) -> Self {
        info!("Opening database at {}", database_url);
        let conn = Database::connect(database_url).await.expect("Failed to connect to the database");
        Migrator::up(&conn, None).await.expect("Failed to run migrations");

        WamDatabase { conn }
    }
}