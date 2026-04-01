use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};

const EXPIRY_SECONDS: u64 = 86400; // 24h

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: i32,
    pub email: String,
    pub exp: u64,
}

pub fn encode_jwt(sub: i32, email: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = jsonwebtoken::get_current_timestamp() + EXPIRY_SECONDS;
    let claims = JwtClaims {
        sub,
        email: email.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn decode_jwt(token: &str, secret: &str) -> Result<TokenData<JwtClaims>, jsonwebtoken::errors::Error> {
    decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test_secret_key_that_is_long_enough";

    #[test]
    fn encode_and_decode_roundtrip() {
        let token = encode_jwt(42, "test@example.com", SECRET).unwrap();
        let data = decode_jwt(&token, SECRET).unwrap();
        assert_eq!(data.claims.sub, 42);
        assert_eq!(data.claims.email, "test@example.com");
    }

    #[test]
    fn decode_with_wrong_secret_fails() {
        let token = encode_jwt(1, "a@b.com", SECRET).unwrap();
        assert!(decode_jwt(&token, "wrong_secret_key_that_is_long_enough").is_err());
    }
}
