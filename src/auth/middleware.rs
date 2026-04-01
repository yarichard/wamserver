use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

use crate::WamServerState;
use super::claims::{decode_jwt, JwtClaims};

pub struct RequireAuth(pub JwtClaims);

impl FromRequestParts<WamServerState> for RequireAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &WamServerState,
    ) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| StatusCode::UNAUTHORIZED)?;

        let claims = decode_jwt(bearer.token(), &state.config.jwt_secret)
            .map_err(|_| StatusCode::UNAUTHORIZED)?
            .claims;

        Ok(RequireAuth(claims))
    }
}
