from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/motel_prestige"
    secret_key: str = "dev-secret-key"

    # Read-only replica mode (VPS admin/reports mirror): every write request
    # except login is refused — business operations happen at the motel only.
    read_only_mode: bool = False

    # JWT authentication
    jwt_secret_key: str = "change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours

    # Key card hardware integration: "simulated" or "orbita"
    keycard_provider: str = "simulated"
    orbita_bridge_url: str = "http://localhost:8765"
    orbita_bridge_api_key: str = ""
    orbita_building: str = "01"

    model_config = {"env_file": ".env"}


settings = Settings()
