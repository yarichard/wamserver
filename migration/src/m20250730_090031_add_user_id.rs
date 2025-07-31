use sea_orm_migration::{prelude::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
        .alter_table(sea_query::Table::alter()
            .table(Message::Table)
            .add_column(ColumnDef::new(Message::UserId).integer().not_null())
            .to_owned()
        )
        .await
        
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Replace the sample below with your own migration scripts
        manager.alter_table(sea_query::Table::alter()
            .table(Message::Table)
            .drop_column(Message::UserId)
            .to_owned()
        )
        .await
    }
}

#[derive(DeriveIden)]
enum Message {
    Table,
    UserId,
}
