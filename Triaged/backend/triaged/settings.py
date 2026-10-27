"""Runtime settings, read from environment variables prefixed ``TRIAGED_``."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRIAGED_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: PostgresDsn = Field(
        default=PostgresDsn("postgresql://triaged:triaged@localhost:5432/triaged"),
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    default_mode: Literal["shadow", "assist", "auto"] = "shadow"


@lru_cache
def get_settings() -> Settings:
    return Settings()
