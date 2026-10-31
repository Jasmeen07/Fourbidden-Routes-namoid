"""Application settings and configuration."""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    NAMOID_CLIENT_ID: str = "test_client_id"
    NAMOID_CLIENT_SECRET: str = "test_client_secret"
    NAMOID_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    NAMOID_ENV: str = "test"

    SESSION_SECRET: str = "dev_session_secret_change_in_production_min_32_chars"
    DATABASE_URL: str = "sqlite:///./grantgate.db"
    AUTH_MODE: str = "mock"
    DEMO_MODE: bool = True

    POLICY_PATH: str = "config/policy.yaml"
    RESOURCES_SEED_PATH: str = "config/resources.seed.yaml"
    USERS_SEED_PATH: str = "config/users.seed.yaml"

    LLM_PROVIDER: str = "template"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "claude-3-7-sonnet-latest"

    SERVICENOW_ENABLED: bool = True
    SERVICENOW_INSTANCE_URL: str = "https://dev-secops.service-now.com"
    SERVICENOW_WEBHOOK_URL: str = ""
    SERVICENOW_TABLE: str = "sn_si_incident"
    SERVICENOW_MOCK_MODE: bool = True


settings = Settings()
